const fetch = require("node-fetch");

const API_KEY = "AIzaSyBF5no_E-wm7rCA4NhP3f0G4h6LX7OCytY"; // put your apiKey here
const EMAIL = "spotifypremium.06072010@gmail.com";;
const PASSWORD = "Sumanyu@06";

async function getToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        returnSecureToken: true,
      }),
    }
  );

  const data = await res.json();
  console.log("ID TOKEN:\n");
  console.log(data.idToken);
}

getToken();