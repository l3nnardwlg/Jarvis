const res = await fetch("http://135.181.117.35:3000/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "123456789"
  },
  body: JSON.stringify({
    message: "Hey Jarvis was geht?"
  })
});

const data = await res.json();
console.log(data.response);