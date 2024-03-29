const express = require('express')
const path = require('path')
const request = require('request')
const fs = require('fs')
const cors = require('cors')
const querystring = require('querystring')
const cookieParser = require('cookie-parser')

const dotenv = require('dotenv')
dotenv.config()

const port = process.env.PORT || 3000
const client_id = process.env.client_id
const client_secret = process.env.client_secret
const redirect_uri = `https://spotlyrics01.herokuapp.com/callback`

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = ''
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

var stateKey = 'spotify_auth_state'

const app = express()

app.use(cors())
   .use(cookieParser())

app.get('/', function(req, res) {

  var state = generateRandomString(16)
  res.cookie(stateKey, state)

  // your application requests authorization
  var scope = 'user-read-currently-playing'
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }))
})

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null
  var state = req.query.state || null
  var storedState = req.cookies ? req.cookies[stateKey] : null

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }))
  } else {
    res.clearCookie(stateKey)
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    }

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token

        var options = {
          url: 'https://api.spotify.com/v1/me/player/currently-playing',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        }
        var trackName = ''
        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          /* DB POPULATOR (resume from after LY: Tear)
          var album_id = body.item.album.id
          var options = {
            url: `https://api.spotify.com/v1/albums/${album_id}/tracks`,
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
          }
          request.get(options, function(error, response, body) {
            var db = JSON.parse(fs.readFileSync(__dirname + '/db.json'))
            body.items.forEach(track => {
              db.push({
                id: track.id,
                name: track.name
              })        
            })
            fs.writeFile(__dirname + '/db.json', JSON.stringify(db), 'utf-8', (err) => {
              if (err) throw err
              console.log('The "data to append" was appended to file!')
            })
          })*/
          trackName = body.item.name
          var isBTS = body.item.artists.find(function(artist) { 
            return artist.name === 'BTS' || 'RM' || 'j-hope' || 'Agust D'
          })
          console.log(body.item)
          if (isBTS) res.redirect(`http://google.com/search?q=${encodeURIComponent(trackName)}+lyrics+doolset`)
          else res.redirect(`http://google.com/search?q=${encodeURIComponent(trackName)}+lyrics+translated`)  
          
        })         

        // we can also pass the token to the browser to make requests from there
        /*
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
        }))
        */
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }))
      }
    })
  }
})

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  }

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token
      res.send({
        'access_token': access_token
      })
    }
  })
})

app.listen(port, () => console.log(`Server listening on port ${port}!`))