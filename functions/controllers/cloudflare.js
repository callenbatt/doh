// we assume we have a reference of "total" domains somewhere
const HOSTNAME_TOTAL = 6691

// the cloudflare endpoint
const BASE_URL = 'https://api.cloudflare.com/client/v4/zones/707ba56801b5cb684fb75f62abdbefcf/custom_hostnames?per_page=50';

// figure out how many pages we need to fetch
const pages = Array.from(Array(Math.ceil(HOSTNAME_TOTAL/50)), (e,i)=>i+1);


async function getAllHostnames() {
  try {
    return await Promise.all(pages.map(page => {
      const url = `${BASE_URL}&page=${page}`;
      const res = await fetch(url);
      return await res.json()
    }))
  }
  catch(e) {

  }
}