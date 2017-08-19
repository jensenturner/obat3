'use strict';

const express = require('express');
const subdomain = require('express-subdomain');
const exphbs = require('express-handlebars');
const mysql = require('mysql');
const SqlString = require('sqlstring');
const moment = require('moment');

const db_credentials = {
  host: "localhost",
  user: "root",
  password: "qwertyuiop[]\\",
  database: "obat3"
};

let pool = mysql.createPool(db_credentials);

let error_handler = function(done) {
  return function(error, results, fields) {
    if (error) throw error;
    if (done) done(results, fields);
  };
};

let app = express();
let router = express.Router();
let hbs = exphbs.create({defaultLayout: 'default'});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.disable('view cache');

router.use(express.static('static'));

router.get('/', (req, res) => {
  let done = function(agencies) {
    res.render('index', {"agencies": agencies, "home": true});
  };
  pool.query('SELECT id, name FROM agencies', error_handler(done));
});

router.get('/av', (req, res) => {
  if (!(req.query.vehicle_id && req.query.date && moment(req.query.date, 'MM/DD/YYYY').isValid())) {
    res.render('error');
  } else {
    let t_initial = moment(req.query.date, 'MM/DD/YYYY');
    let t_final = moment(t_initial).add(1, 'days');

    let vehicle_sql = "SELECT vehicles.id AS id, vehicles.fleet_number, fleets.name AS fleet_name, CONCAT(engines.make, ' ', engines.model) AS engine, CONCAT(transmissions.make, ' ', transmissions.model) AS transmission, liveries.name AS livery FROM vehicles JOIN fleets ON vehicles.fleet_id = fleets.internal_id JOIN engines ON fleets.engine_id = engines.internal_id JOIN transmissions ON fleets.transmission_id = transmissions.internal_id JOIN liveries ON vehicles.livery_id = liveries.internal_id WHERE vehicles.id = ?";
    let vehicle_sql_string = SqlString.format(vehicle_sql, req.query.vehicle_id);

    let updates_sql = 'SELECT trips.id AS trip_id, trips.headsign, routes.number, DATE_FORMAT(FROM_UNIXTIME(MIN(updates.time)), \'%a %b %D %r\') AS start_time FROM updates JOIN trips ON updates.trip_id = trips.id JOIN routes ON trips.route_id = routes.id WHERE updates.vehicle_id = ? AND FROM_UNIXTIME(updates.time) BETWEEN ? AND ? GROUP BY trips.id ORDER BY min(updates.time);'
    let updates_sql_string = SqlString.format(updates_sql, [req.query.vehicle_id, t_initial.toDate(), t_final.toDate()]);

    let done = function(updates, vehicle_info) {
      res.render('av', {"updates": updates, "vehicle_info": vehicle_info[0], "date": t_initial.format("M/D/YYYY")});
    };

    pool.query(vehicle_sql_string, error_handler(function(vehicle_info) {
      pool.query(updates_sql_string, error_handler(function(updates) {
        done(updates, vehicle_info);
      }));
    }));
  }
});

router.get('/ar', (req, res) => {
  if (!(req.query.route_id && req.query.date && moment(req.query.date, 'MM/DD/YYYY').isValid())) {
    res.render('error');
  } else {
    let t_initial = moment(req.query.date, 'MM/DD/YYYY');
    let t_final = moment(t_initial).add(1, 'days');

    let route_sql = 'SELECT routes.id, routes.number, routes.description FROM routes WHERE routes.id = ?';
    let route_sql_string = SqlString.format(route_sql, req.query.route_id);

    let vehicles_sql = "SELECT vehicles.fleet_number, fleets.name AS fleet_name, CONCAT(engines.make, ' ', engines.model) AS engine, CONCAT(transmissions.make, ' ', transmissions.model) AS transmission, liveries.name AS livery, trips.headsign, trips.id AS trip_id, DATE_FORMAT(FROM_UNIXTIME(updates.time), '%a %b %D %r') AS start_time FROM updates JOIN trips ON updates.trip_id = trips.id JOIN vehicles ON updates.vehicle_id = vehicles.id JOIN fleets ON vehicles.fleet_id = fleets.internal_id JOIN engines ON fleets.engine_id = engines.internal_id JOIN transmissions ON fleets.transmission_id = transmissions.internal_id JOIN liveries ON vehicles.livery_id = liveries.internal_id JOIN routes ON trips.route_id = routes.id JOIN (SELECT updates.vehicle_id, MIN(updates.time) AS start_time FROM updates JOIN trips ON updates.trip_id = trips.id JOIN routes ON trips.route_id = routes.id WHERE routes.id = ? AND FROM_UNIXTIME(updates.time) BETWEEN ? AND ? GROUP BY updates.vehicle_id , updates.trip_id) u2 WHERE updates.vehicle_id = u2.vehicle_id AND updates.time = u2.start_time ORDER BY updates.time"
    let vehicles_sql_string = SqlString.format(vehicles_sql, [req.query.route_id, t_initial.toDate(), t_final.toDate()]);


    let done = function(vehicles, route_info) {
      res.render('ar', {"vehicles": vehicles, "route_info": route_info[0], "date": t_initial.format("M/D/YYYY")});
    };

    pool.query(route_sql_string, error_handler(function(route_info) {
      pool.query(vehicles_sql_string, error_handler(function(vehicles) {
        done(vehicles, route_info);
      }));
    }));
  }
});

router.get('/r', (req, res) => {
  if (!(req.query.stop_id && req.query.trip_id && moment(req.query.month, 'MM/YYYY').isValid())) {
    res.render('error');
  } else {
    let t_initial = moment(req.query.month, 'MM/YYYY');
    let t_final = moment(t_initial).add(1, 'months');

    let sql = "SELECT vehicles.fleet_number, fleets.name AS fleet_name, CONCAT(engines.make, ' ', engines.model) AS engine, CONCAT(transmissions.make, ' ', transmissions.model) AS transmission, liveries.name AS livery, DATE_FORMAT(FROM_UNIXTIME(updates.time), '%a %b %D %r') AS time, updates.schedule_deviation/60 AS schedule_deviation FROM updates JOIN vehicles ON updates.vehicle_id = vehicles.id JOIN fleets ON vehicles.fleet_id = fleets.internal_id JOIN engines ON fleets.engine_id = engines.internal_id JOIN transmissions ON fleets.transmission_id = transmissions.internal_id JOIN liveries ON vehicles.livery_id = liveries.internal_id JOIN stops ON stops.id = ? JOIN (SELECT vehicle_id, MIN(SQRT(POW((stops.latitude - updates.latitude), 2) + POW((stops.longitude - updates.longitude), 2))) AS `distance_deviation` FROM updates JOIN trips ON updates.trip_id = trips.id JOIN stops ON stops.id = ? WHERE trips.id = ? AND FROM_UNIXTIME(updates.time) BETWEEN ? AND ? GROUP BY vehicle_id) u2 WHERE updates.vehicle_id = u2.vehicle_id AND SQRT(POW((stops.latitude - updates.latitude), 2) + POW((stops.longitude - updates.longitude), 2)) = u2.distance_deviation AND updates.trip_id = ? ORDER BY updates.time"; // stop id, stop id, trip id, start time, end time
    let sql_string = SqlString.format(sql, [req.query.stop_id, req.query.stop_id, req.query.trip_id, t_initial.toDate(), t_final.toDate(), req.query.trip_id]);

    let done = function(updates) {
      res.render('r', {"updates": updates, "trip_id": req.query.trip_id, "month": t_initial.format("M/YYYY")});
    };

    pool.query(sql_string, error_handler(done));
  }

});


router.get('/i', (req, res) => { // Web service (Information)
  if (req.query.agency_id) {
    let sql, sql_string;
    if (!req.query.route_id) {
      if (req.query.get_routes) {
        sql = 'SELECT id, number, description FROM routes WHERE agency_id = ? ORDER BY CAST(number AS UNSIGNED)';
        sql_string = SqlString.format(sql, req.query.agency_id);
      } else if (req.query.get_fleets) {
        sql = 'SELECT f.internal_id AS id, f.name, CONCAT(e.make, \' \', e.model) AS engine, CONCAT(t.make, " ", t.model) AS transmission FROM fleets f LEFT JOIN engines e ON f.engine_id = e.internal_id LEFT JOIN transmissions t ON f.transmission_id = t.internal_id WHERE agency_id = ? ORDER BY f.name';
        sql_string = SqlString.format(sql, req.query.agency_id);
      } else if (req.query.fleet_id) {
        sql = 'SELECT v.id, v.fleet_number, l.name AS livery FROM vehicles v LEFT JOIN liveries l ON v.livery_id = l.internal_id WHERE fleet_id = ?';
        sql_string = SqlString.format(sql, req.query.fleet_id);
      }
    } else {
      if (!req.query.stop_id) {
        sql = 'SELECT id, agency_code, description, direction FROM stops JOIN `routes-stops` ON stops.id = `routes-stops`.stop_id WHERE `routes-stops`.route_id = ?';
        sql_string = SqlString.format(sql, req.query.route_id);
      } else {
        sql = 'SELECT u1.trip_id AS id, SEC_TO_TIME(AVG(TIME_TO_SEC(TIME(FROM_UNIXTIME(u1.time - u1.schedule_deviation))))) AS scheduled_time FROM updates u1 JOIN stops ON stops.id = ? JOIN ( SELECT vehicle_id, MIN(SQRT(POW((stops.latitude - updates.latitude), 2) + POW((stops.longitude - updates.longitude), 2))) AS `distance_deviation` FROM updates JOIN stops ON stops.id = ? JOIN trips ON updates.trip_id = trips.id JOIN routes ON trips.route_id = routes.id WHERE routes.id = ? GROUP BY         vehicle_id ) u2 ON u1.vehicle_id = u2.vehicle_id AND SQRT(POW((stops.latitude - u1.latitude), 2) + POW((stops.longitude - u1.longitude), 2)) = u2.distance_deviation GROUP BY u1.trip_id ORDER BY scheduled_time';
        sql_string = SqlString.format(sql, [req.query.stop_id, req.query.stop_id, req.query.route_id]);
      }
    }
    pool.query(sql_string, error_handler((results) => {
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify(results));
    }));
  }
});

router.get('/vehicle_status', (req, res) => { res.render('vehicle_status', {title: "1_3751 | Vehicle Status", header: "1_3751"}); });

app.use(subdomain('obat', router));
app.listen(8080, () => { console.log('listening 8080'); });
