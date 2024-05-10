const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const convertDbObjectToResponseObject1 = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDbObjectToResponseObject2 = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDbObjectToResponseObject3 = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(
      jwtToken,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImNocmlzdG9waGVyX3BoaWxsaXBzIiwiaWF0IjoxNzE0ODA2NjU3fQ.pIumeDnyzloAfvrku_BKfxMHn5Nf9YO3iqhKWc6khGk',
      async (error, payload) => {
        if (error) {
          response.status(401)
          response.send('Invalid JWT Token')
        } else {
          next()
        }
      },
    )
  }
}

app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid User')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(
        payload,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImNocmlzdG9waGVyX3BoaWxsaXBzIiwiaWF0IjoxNzE0ODA2NjU3fQ.pIumeDnyzloAfvrku_BKfxMHn5Nf9YO3iqhKWc6khGk',
      )
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid Password')
    }
  }
})

app.get('/states/', authenticateToken, async (request, response) => {
  const getstates = `
    SELECT
      *
    FROM
      state
    ORDER BY 
    state_id;
    `
  const statesArray = await db.all(getstates)
  response.send(
    statesArray.map(eachstate => convertDbObjectToResponseObject1(eachstate)),
  )
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getstateQuery = `
    SELECT
      *
    FROM
      state
    WHERE
        state_id = ?;`
  const state = await db.get(getstateQuery, stateId)
  response.send(convertDbObjectToResponseObject2(state))
})

app.post('/districts/', authenticateToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const adddistrictQuery = `
    INSERT INTO
    district (district_name,state_id,cases,cured,active,deaths)
    VALUES
      (?,?,?,?,?,?);`

  const dbResponse = await db.run(adddistrictQuery, [
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  ])
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getdistrictQuery = `
    SELECT
      *
    FROM
      district
    WHERE
      district_id = ${districtId};`
    const district = await db.get(getdistrictQuery)
    response.send(convertDbObjectToResponseObject3(district))
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `
    UPDATE
      district
    SET
      district_name = ?,
      state_id = ?,
      cases = ?,
      cured = ?,
      active = ?,
      deaths = ?
    WHERE
      district_id = ?`
    const updateValues = [
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
      districtId,
    ]
    const updatedDistrict = await db.run(updateDistrictQuery, updateValues)
    response.send('District Details Updated')
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deletedistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`
    await db.run(deletedistrictQuery)
    response.send('District Removed')
  },
)

app.get('/directors/', authenticateToken, async (request, response) => {
  const getdirectors = `
    SELECT
      *
    FROM
      director
    ORDER BY 
    director_id;
    `
  const directorsArray = await db.all(getdirectors)
  response.send(directorsArray)
})

app.get(
  '/districts/:districtId/details/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getStateNameQuery = `
    select state_name as stateName from district natural join state
    where district_id = ${districtId};`
    //With this we will get state_name as stateName using the state_id
    const getStateNameQueryResponse = await db.get(getStateNameQuery)
    response.send(getStateNameQueryResponse)
  },
) //sending the required response

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getstateQuery = `
    SELECT
      *
    FROM
      state
    WHERE
        state_id = ?;`
  const state = await db.get(getstateQuery, stateId)
  response.send(convertDbObjectToResponseObject2(state))
})

app.get(
  '/states/:stateId/stats',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getstatesstatsQuery = `
   select
      sum(cases),
      sum(cured),
      sum(active),
      sum(deaths)
    from
    district
    WHERE
      state_id = ${stateId}`
    const stats = await db.get(getstatesstatsQuery)
    console.log(stats)
    response.send({
      totalCases: stats['sum(cases)'],
      totalCured: stats['sum(cured)'],
      totalActive: stats['sum(active)'],
      totalDeaths: stats['sum(deaths)'],
    })
  },
)

module.exports = app
