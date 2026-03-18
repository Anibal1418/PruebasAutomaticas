import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = "https://restful-booker.herokuapp.com";

export const options = {
  vus: 2,
  iterations: 4,
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
    checks: ["rate>0.95"],
  },
};

export function setup() {
  const authPayload = JSON.stringify({
    username: "admin",
    password: "password123",
  });

  const authRes = http.post(`${BASE_URL}/auth`, authPayload, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  console.log(`SETUP AUTH status=${authRes.status} body=${authRes.body}`);

  if (authRes.status !== 200 && authRes.status !== 201) {
    throw new Error(`Auth failed with status ${authRes.status}: ${authRes.body}`);
  }

  let token = null;
  try {
    token = authRes.json("token");
  } catch (e) {
    throw new Error(`Auth response is not valid JSON: ${authRes.body}`);
  }

  if (!token) {
    throw new Error(`Auth did not return token: ${authRes.body}`);
  }

  return { token };
}

export default function (data) {
  const uniqueSuffix = `${__VU}-${__ITER}`;

  let res = http.get(`${BASE_URL}/ping`, {
    headers: {
      Accept: "text/plain, application/json",
    },
  });

  console.log(`PING status=${res.status} body=${res.body}`);

  check(res, {
    "ping responde": (r) => r.status === 201 || r.status === 200,
  });

  const bookingPayload = JSON.stringify({
    firstname: `Anibal${uniqueSuffix}`,
    lastname: "CargaLigera",
    totalprice: 150 + __ITER,
    depositpaid: true,
    bookingdates: {
      checkin: "2026-04-10",
      checkout: "2026-04-15",
    },
    additionalneeds: "Breakfast",
  });

  res = http.post(`${BASE_URL}/booking`, bookingPayload, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  console.log(`CREATE status=${res.status} body=${res.body}`);

  check(res, {
    "crea booking": (r) => r.status === 200 || r.status === 201,
    "devuelve bookingId": (r) => {
      try {
        return !!r.json("bookingid");
      } catch (e) {
        return false;
      }
    },
  });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Create booking failed with status ${res.status}: ${res.body}`);
  }

  let bookingId = null;
  try {
    bookingId = res.json("bookingid");
  } catch (e) {
    throw new Error(`Create booking response is not valid JSON: ${res.body}`);
  }

  if (!bookingId) {
    throw new Error(`Create booking did not return bookingId: ${res.body}`);
  }

  res = http.get(`${BASE_URL}/booking/${bookingId}`, {
    headers: {
      Accept: "application/json",
    },
  });

  console.log(`GET status=${res.status} body=${res.body}`);

  check(res, {
    "lee booking": (r) => r.status === 200,
    "firstname correcto": (r) => {
      try {
        return r.json("firstname") === `Anibal${uniqueSuffix}`;
      } catch (e) {
        return false;
      }
    },
  });

  const patchPayload = JSON.stringify({
    firstname: "Anibal",
    additionalneeds: "Breakfast and dinner",
  });

  res = http.patch(`${BASE_URL}/booking/${bookingId}`, patchPayload, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: `token=${data.token}`,
    },
  });

  console.log(`PATCH status=${res.status} body=${res.body}`);

  check(res, {
    "actualiza booking": (r) => r.status === 200 || r.status === 201,
  });

  res = http.get(`${BASE_URL}/booking/${bookingId}`, {
    headers: {
      Accept: "application/json",
    },
  });

  console.log(`VERIFY PATCH status=${res.status} body=${res.body}`);

  check(res, {
    "patch se refleja": (r) => {
      try {
        return (
          r.status === 200 &&
          r.json("firstname") === "Anibal" &&
          r.json("additionalneeds") === "Breakfast and dinner"
        );
      } catch (e) {
        return false;
      }
    },
  });

  res = http.del(`${BASE_URL}/booking/${bookingId}`, null, {
    headers: {
      Accept: "application/json",
      Cookie: `token=${data.token}`,
    },
  });

  console.log(`DELETE status=${res.status} body=${res.body}`);

  check(res, {
    "elimina booking": (r) =>
      r.status === 200 ||
      r.status === 201 ||
      r.status === 202 ||
      r.status === 204,
  });

  res = http.get(`${BASE_URL}/booking/${bookingId}`, {
    headers: {
      Accept: "application/json",
    },
  });

  console.log(`VERIFY DELETE status=${res.status} body=${res.body}`);

  check(res, {
    "booking ya no disponible": (r) => r.status === 404 || r.status === 405,
  });

  sleep(1);
}