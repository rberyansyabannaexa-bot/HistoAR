const res = await fetch(ATOMESUS_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.ATOMESUS_API_KEY}`,
  },
  body: JSON.stringify({
    model: "cipher",
    messages: [
      {
        role: "user",
        content: promptFinal,
      },
    ],
    stream: false,
  }),
});

const text = await res.text();

console.log(text);

return new Response(text, {
  headers: {
    "Content-Type": "application/json",
  },
});
