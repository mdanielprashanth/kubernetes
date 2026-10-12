
const http = require("http");

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    return res.end("OK");
  }

  // Deliberately consume CPU for HPA testing
  const end = Date.now() + 200;
  while (Date.now() < end) {
    Math.sqrt(Math.random() * 1000000);
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("CPU work completed");
});

server.listen(3000, "0.0.0.0", () => {
  console.log("HPA demo listening on port 3000");
});
