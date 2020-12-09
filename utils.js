const TRACKDOTA_SEARCH = {
  path: '84vk6MLxfNH/14ly9F',
  token: 'f9524e16-3f95-4815-c99e-cb430445595c'
};

const TRACKDOTA_GET_TEAM = {
  path: 'LyVA323MgZf/2wd2W2',
  token: 'a906eb59-d5ae-d4eb-1772-cf1d67166bd8'
};

const DEFAULT_LOGO = 'https://github.com/xyeta/trash/raw/main/Dota-2-Logo%5B1%5D.png';

let cachedTeams = [];

(async function() {
  try {
    cachedTeams = await fetch('https://api.opendota.com/api/teams')
      .then(response => response.json())
      .then(teams => teams.map(({ team_id: id, name, tag, logo_url: logo }) => ({ id, name, tag, logo })));
  } catch (e) {
    
  }
}());

function trackDotaAPI(method, params = {}) {
  return fetch(`https://cx.trackdota.com/api/${method.path}?_r=${btoa(JSON.stringify(params)).replace("+", "-").replace("/", "_").replace(/=+$/, "")}`, { 
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
      'x-token': method.token
    }
  })
  .then(data => data.json());
}

async function searchTeam(query) {
  if (!query || query.length < 2) return Promise.resolve([]);

  const result = [];

  try {
    const trackDotaResult = await trackDotaAPI(TRACKDOTA_SEARCH, { query })
      .then(({ esports }) => esports.teams.map(({ teamId: id, name, logoBlob }) => ({ id, name, ... logoBlob && { logo: `https://cx.trackdota.com/blob/${logoBlob}` } })));

    result.push(... trackDotaResult);
  } catch(e) {}

  const regexp = new RegExp(query, 'ig');

  cachedTeams.filter(team => (result.findIndex(({ id }) => id === team.id) === -1 && (team.tag.match(regexp) || team.name.match(regexp))))
  cachedTeams.reduce((acc, team) => {
    if (acc.findIndex(({ id }) => id === team.id) === -1 && (team.tag.match(regexp) || team.name.match(regexp))) {
      acc.push(team);
    }

    return acc;
  }, result);
  
  return Promise.resolve(result);
}

function getMatchHistory(teamA, teamB) {
  if (teamA === -1 || teamB === -1) return [];

  const query = `
    SELECT 
      start_time,
      duration,
      radiant_team_id,
      dire_team_id,
      dire_score,
      radiant_score,
      radiant_win,
      picks_bans
    FROM matches
    WHERE
      (radiant_team_id = ${teamA} OR radiant_team_id = ${teamB}) 
      AND (dire_team_id = ${teamA} OR dire_team_id = ${teamB}) 
    ORDER BY 
      match_id DESC 
    LIMIT 6
  `;

  const picksReducer = (picks, dire) => picks.reduce((picks, { is_pick, hero_id, team }) => {
    if (is_pick && team === dire) {
      picks.push(hero_id);
    }

    return picks;
  }, []);

  return fetch(`https://api.opendota.com/api/explorer?sql=${encodeURI(query)}`)
    .then(response => response.json())
    .then(({ rows }) => rows.map(row => {
      return {
        date: new Date(row.start_time * 1000),
        duration: row.duration,
        [row.radiant_team_id]: {
          score: row.radiant_score,
          winner: Boolean(row.radiant_win),
          heroes: picksReducer(row.picks_bans, 0),
        },
        [row.dire_team_id]: {
          score: row.dire_score,
          winner: Boolean(!row.radiant_win),
          heroes: picksReducer(row.picks_bans, 1),
        }
      }
    }));
}

async function getPlayers(teamId) {
  if (teamId === -1) return [];

  let players = [];
  try {
    players = await trackDotaAPI(TRACKDOTA_GET_TEAM, { teamId })
      .then(({ team }) => team.roster.map(({ playerId: id, name, country, portraitBlob: portrait }) => {
        return { 
          id, 
          name, 
          ... country && {
            country: country.code2.toLowerCase()
          }, 
          ... portrait && {
            photo: `https://cx.trackdota.com/blob/${portrait}`
          }
        }
      }));
  } catch (e) {
    try {
      players = await fetch(`https://api.opendota.com/api/teams/${teamId}/players`)
        .then(data => data.json() || [])
        .then(response => response.reduce((acc, { is_current_team_member, account_id: id, name }) => {
          if (is_current_team_member) {
            acc.push({ id, name });
          }

          return acc;
        }, []));
    } catch (e) {
      return [];
    }
  }

  for (const player of players) {
    if (!player.photo) {
      player.photo = await getPlayerPhoto(player.id);
    }
  }

  return players;
}

function getDotabuffPhoto(playerId, avatarToken) {
  function mH(e) {
    return function (e) {
      if (Array.isArray(e)) return vH(e)
    }(e) || function (e) {
      if ("undefined" != typeof Symbol && Symbol.iterator in Object(e)) return Array.from(e)
    }(e) || function (e, t) {
      if (!e) return;
      if ("string" == typeof e) return vH(e, t);
      var n = Object.prototype.toString.call(e).slice(8, -1);
      "Object" === n && e.constructor && (n = e.constructor.name);
      if ("Map" === n || "Set" === n) return Array.from(e);
      if ("Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return vH(e, t)
    }(e) || function () {
      throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
    }()
  }

  function vH(e, t) {
    (null == t || t > e.length) && (t = e.length);
    for (var n = 0, r = new Array(t); n < t; n++) r[n] = e[n];
    return r
  }

  var gH = {
    charset: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(""),
    encode: function (e) {
      if (0 === e || void 0 === e) return 0;
      for (var t = []; e > 0;) t = [gH.charset[e % 62]].concat(mH(t)), e = Math.floor(e / 62);
      return t.join("")
    }
  };

  return "https://riki.dotabuff.com/ppa/".concat(gH.encode(playerId), "/").concat(avatarToken) || !1
}

async function getPlayerPhoto(id) {
  try {
    return await isImageBroken(`https://cdn.stratz.com/images/dota2/players/${id}.png`);
  } catch (e) {
    return 'https://i.imgur.com/H5b0DVa.png'
  }
}

async function getTeamLogo(id) {
  if (id === -1) {
    return DEFAULT_LOGO;
  }

  const images = [
    'https://steamcdn-a.akamaihd.net/apps/dota2/images/team_logos/$id.png',
    `https://cdn.maxjia.com/app/dota2/teamlogo/$id.png`
  ];

  for (const image of images) {
    try {
      return await isImageBroken(image.replace(/\$id/, id));
    } catch (e) { }
  }
}

async function isImageBroken(url) {
  const image = new Image();

  return new Promise((resolve, reject) => {
    image.onerror = function () {
      return reject();
    }

    image.onload = function () {
      return resolve(url);
    }

    image.src = url;
  });
}
