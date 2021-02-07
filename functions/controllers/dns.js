const { db } = require("../firebase/admin");
const fetch = require("node-fetch");
const { document } = require("firebase-functions/lib/providers/firestore");

const digdoh = async (host) => {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${host}`);
    return await response.json();
  } catch (e) {
    return { error: e };
  }
};

const formatDocumentDataOnCreate = (dig) => {
  const date = new Date().toISOString();
  return {
    created: date,
    updated: date,
    monitoring: true,
    Status: dig.Status,
    Question: dig.Question,
    Answer: dig.Answer,
  };
};

const checkIfHostExistsOnCreate = (documentSnapshot, host) => {
  const data = documentSnapshot.data();
  const dns = data.dns || [];
  return dns.length
    ? dns.find((dig) => {
        return dig.Question[0].name === `${host}.`;
      })
    : false;
};

exports.dns = async (req, res) => {
  const querySnapshot = await db.collection("dns").get();
  const docs = await Promise.all(
    querySnapshot.docs.map(async (queryDocumentSnapshot) => {
      const data = queryDocumentSnapshot.data();
      const dnsArray = data.dns;
      let queryHasChanged = false;

      const dnsQueries = await Promise.all(
        dnsArray.map(async (dnsQuery) => {
          // if we're monitoring the host in another job,
          // we don't need to look it up here
          if (dnsQuery.monitoring) {
            return dnsQuery;
          }

          const response = await fetch(
            `https://dns.google/resolve?name=${dnsQuery.Question[0].name}`
          );

          const json = await response.json();

          const queryChange = queryCompare(dnsQuery, json);

          if (queryChange) {
            queryHasChanged = true;
            // send to dns monitoring list
            // post alert message
            return {
              ...dnsQuery,
              Status: json.Status,
              Question: json.Question,
              Answer: json.Answer,
              updated: new Date().toISOString(),
              monitoring: true,
            };
          } else {
            return dnsQuery;
          }
        })
      );
      if (queryHasChanged) {
        queryDocumentSnapshot.ref.update({ dns: dnsQueries });
      }
      return dnsQueries;
    })
  );
  res.json(docs);
};

const queryCompare = (query1, query2) => {
  if (!query1.Answer && !query2.Answer) {
    return;
  }

  if (!query1.Answer || !query2.Answer) {
    return { type: "status" };
  }

  if (
    query1.Answer.length === 1 &&
    query2.Answer.length === 1 &&
    query2.Answer[0].data === query1.Answer[0].data
  ) {
    return;
  }

  const cname = query2.Answer.find((a) => {
    return a.type === 5 && query2.Question[0].name === a.name;
  });

  if (
    cname &&
    cname.data === query1.Answer[0].data &&
    cname.name === query1.Answer[0].name
  ) {
    return;
  }

  const answerDiff = answerCompare(query1.Answer, query2.Answer, [
    "data",
    "name",
  ]);

  if (answerDiff.diff1.length === 0 && answerDiff.diff2.length === 0) {
    return;
  } else {
    return { type: "answer", diff: answerDiff };
  }
};

const answerCompare = (arr1, arr2, keys = Object.keys(arr1[0])) => {
  return arr1.reduce(
    (accumulator, current1) => {
      const foundIndex = accumulator.diff2.findIndex((current2) => {
        return keys.every((key) => current1[key] === current2[key]);
      });
      if (foundIndex > -1) {
        accumulator.diff2.splice(foundIndex, 1);
      } else {
        accumulator.diff1.push(current1);
      }
      return accumulator;
    },
    { diff1: [], diff2: [...arr2] }
  );
};

exports.createDNSDoc = async (req, res) => {
  try {
    const collectionReference = db.collection("dns");
    const documentReference = await collectionReference.doc(req.body.namespace);
    const documentSnapshot = await documentReference.get();

    if (
      documentSnapshot.exists &&
      checkIfHostExistsOnCreate(documentSnapshot, req.body.host)
    ) {
      res
        .status(422)
        .json({ message: "this hostname already exists for this client" });
      return;
    }

    const dig = await digdoh(req.body.host);
    const query = formatDocumentDataOnCreate(dig);

    if (documentSnapshot.exists) {
      documentReference.update({ dns: [...dns, query] });
      res.status(200).json({ message: "hostname added", query: query });
      return;
    } else {
      collectionReference.doc(req.body.namespace).set({ dns: [query] });
      res
        .status(200)
        .json({ message: "document created and hostname added", query: query });
      return;
    }
  } catch (e) {
    res
      .status(500)
      .json({ error: e, message: "an error occurred with this request" });
    return;
  }
};
