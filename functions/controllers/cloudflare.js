const fetch = require("node-fetch");

/**
 * Request data from the cloudflare hostnames endpoint
 * @param {Number} page
 * @returns {JSON} response data
 */
const requestHostnames = async (page = 1) => {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zone_id}/custom_hostnames?per_page=50&page=${page}`,
      {}
    );
    return await response.json();
  } catch (e) {
    console.error(e);
    return { error: e };
  }
};

/**
 * Formats the hostname API response to just the
 * relevant data
 * @param {Array} result of hostname fetch
 * @returns {Array} of formatted hostname data
 */
const formatHostnameResult = (result) => {
  return result.map((item) => {
    return {
      hostname: item.hostname,
      status: item.ssl.status,
      dc: item.custom_metadata?.dc,
      tenant_name: item.custom_metadata?.tenant_name,
      created_at: item.created_at,
    };
  });
};

/**
 * Creates an array of numbers for fetching multiple
 * pages in an API
 * @param {Number} pages final number in array
 * @param {Number} offset page to start the array
 * @returns {Array} of page numbers
 */
const createArrayOfPages = (pages, offset = 1) => {
  return Array.from(Array(pages - offset), (e, i) => i + (1 + offset));
};

/**
 * Formats an array of hostname data, organized by tenant_name
 * @param {Array} hostnames returned from getAllHostnames
 * @returns {Array} organized by tenant_name 
 */
const formatAllHostnames = (hostnames) => {
  return hostnames.reduce((a, c) => {
    a.hostname ? a.hostname.push(c) : (a[c.hostname] = c);
    return a;
  }, {});
};

/**
 * Fetches all pages of hostname data from Cloudflare API
 * @returns {Array} of formatted hostname data
 */
const getAllHostnames = async () => {
  const firstPage = await requestHostnames();
  const firstData = formatHostnameResult(firstPage.result);
  const restPages = createArrayOfPages(firstPage.result_info.total_pages);
  const restData = await Promise.all(
    restPages.map(async (page) => {
      const response = await requestHostnames(page);
      return formatHostnameResult(response.result);
    })
  );
  const hostnamesNew = formatAllHostnames([...firstData, ...restData.flat()]);
};


