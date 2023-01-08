const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;
const initialize = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running at http://localhost/3000/:");
    });
  } catch (e) {
    console.log(`${e.message}`);
    process.exit(1);
  }
};

initialize();

//api1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const query = `select * from user where username = '${username}';`;
  const queryresult = await db.get(query);
  if (queryresult == undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const iscomparing = await bcrypt.compare(password, queryresult.password);
    if (iscomparing) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      //console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//api 3

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    //console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convert = (each) => {
  return {
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const query = `
    select * from state;
    `;
  const res = await db.all(query);
  response.send(res.map((a) => convert(a)));
});

//api 3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const query = `
    select * from state where state_id = '${stateId}';
    `;
  const res = await db.get(query);
  response.send(convert(res));
});

//api 4

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query = `
    insert into district (district_name,state_id,cases,cured,active,deaths)
    values('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');
    `;
  const res = await db.run(query);
  response.send("District Successfully Added");
});

//api 5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `
    select * from district where district_id = '${districtId}';
    `;
    const res = await db.get(query);
    response.send({
      districtId: res.district_id,
      districtName: res.district_name,
      stateId: res.state_id,
      cases: res.cases,
      cured: res.cured,
      active: res.active,
      deaths: res.deaths,
    });
  }
);

//api 6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `
    delete  from district where district_id = '${districtId}';
    `;
    const res = await db.run(query);
    response.send("District Removed");
  }
);

//api 7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const query = `
    update district 
    set district_name = '${districtName}', 
        state_id = '${stateId}', 
        cases = '${cases}', 
        cured = '${cured}', 
        active = '${active}', 
        deaths = '${deaths}'
     where district_id = '${districtId}';
    `;
    const res = await db.run(query);
    response.send("District Details Updated");
  }
);

//api 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
