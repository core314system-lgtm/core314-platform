exports.handler = async (event) => {
  console.log("INGRESS PROBE HIT", event.httpMethod);
  return { statusCode: 200, body: "ok" };
};
