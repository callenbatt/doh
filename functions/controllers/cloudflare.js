const fetch = require("node-fetch");

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

const formatResult = (result) => {
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

const getAllHostnames = async () => {
  const firstPage = await requestHostnames();
  const pages = Array.from(
    Array(firstPage.result_info.total_pages - 1),
    (e, i) => i + 2
  );
  const firstData = formatResult(firstPage.result);
  const restData = await Promise.all(
    pages.map(async (page) => {
      const response = await requestHostnames(page);
      return formatResult(response.result);
    })
  );
  return [...firstData, ...restData.flat()]
};
