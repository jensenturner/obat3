'use strict';

const express = require('express');
const subdomain = require('express-subdomain');
const exphbs = require('express-handlebars');
const mysql = require('mysql');
const SqlString = require('sqlstring');
const moment = require('moment');
const groupBy = require('group-by');

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
  if (!(req.query.vehicle_id && req.query.date && moment(req.query.date, 'MM/YYYY').isValid())) {
    res.render('error');
  } else {
    let t_initial = moment(req.query.date, 'MM/YYYY');
    let t_final = moment(t_initial).add(1, 'months');

    let vehicle_sql = "SELECT vehicles.id AS id, vehicles.fleet_number, fleets.name AS fleet_name, CONCAT(engines.make, ' ', engines.model) AS engine, CONCAT(transmissions.make, ' ', transmissions.model) AS transmission, liveries.name AS livery FROM vehicles JOIN fleets ON vehicles.fleet_id = fleets.internal_id JOIN engines ON fleets.engine_id = engines.internal_id JOIN transmissions ON fleets.transmission_id = transmissions.internal_id JOIN liveries ON vehicles.livery_id = liveries.internal_id WHERE vehicles.id = ?";
    let vehicle_sql_string = SqlString.format(vehicle_sql, req.query.vehicle_id);

    let updates_sql = 'SELECT trips.id AS trip_id, trips.headsign, routes.number, DATE_FORMAT(FROM_UNIXTIME(MIN(updates.time)), \'%a %b %D %r\') AS start_time, DATE_FORMAT(FROM_UNIXTIME(MIN(updates.time)), \'%c/%e/%Y\') AS the_day FROM updates JOIN trips ON updates.trip_id = trips.id JOIN routes ON trips.route_id = routes.id WHERE updates.vehicle_id = ? AND FROM_UNIXTIME(updates.time) BETWEEN ? AND ? GROUP BY trips.id ORDER BY min(updates.time)'
    let updates_sql_string = SqlString.format(updates_sql, [req.query.vehicle_id, t_initial.toDate(), t_final.toDate()]);

    let done = function(updates, vehicle_info) {
      res.render('av', {"updates": groupBy(updates, "the_day"), "vehicle_info": vehicle_info[0], "date": t_initial.format("M/D/YYYY")});
    };

    pool.query(vehicle_sql_string, error_handler(function(vehicle_info) {
      pool.query(updates_sql_string, error_handler(function(updates) {
        done(updates, vehicle_info);
      }));
    }));
  }
});

router.get('/af', (req, res) => {
  if (!(req.query.fleet_id && req.query.date && moment(req.query.date, 'MM/DD/YYYY').isValid())) {
    res.render('error');
  } else {
    let t_initial = moment(req.query.date, 'MM/DD/YYYY');
    let t_final = moment(t_initial).add(1, 'days');

    let fleet_sql =
      `SELECT fleets.internal_id AS fleet_id,
             fleets.name,
             Concat(engines.make, ' ', engines.model)             AS engine,
             Concat(transmissions.make, ' ', transmissions.model) AS transmission,
             Count(CASE fleet_id
                     WHEN fleets.internal_id THEN 1
                     ELSE NULL
                   END)                                           AS fleet_size
      FROM   fleets
             JOIN vehicles
               ON fleets.internal_id = vehicles.fleet_id
             JOIN engines
               ON fleets.engine_id = engines.internal_id
             JOIN transmissions
               ON fleets.transmission_id = transmissions.internal_id
      WHERE  fleets.internal_id = ?`;
    let fleet_sql_string = SqlString.format(fleet_sql, req.query.fleet_id);

    let vehicle_sql =
      `SELECT vehicles.id AS vehicle_id,
             vehicles.fleet_number,
             liveries.name AS livery
      FROM   vehicles
             JOIN liveries
               ON vehicles.livery_id = liveries.internal_id
      WHERE  vehicles.fleet_id = ?`;
    let vehicle_sql_string = SqlString.format(vehicle_sql, req.query.fleet_id);

    let updates_sql =
      `SELECT   vehicles.id AS vehicle_id,
               others.trip_id,
               others.number,
               others.headsign,
               others.start_time
      FROM     vehicles
      JOIN
               (
                        SELECT   trips.id AS trip_id,
                                 trips.headsign,
                                 routes.number,
                                 Min(updates.time)                                            AS i_time,
                                 Date_format(From_unixtime(Min(updates.time)), '%a %b %D %r') AS start_time
                        FROM     updates
                        JOIN     trips
                        ON       updates.trip_id = trips.id
                        JOIN     routes
                        ON       trips.route_id = routes.id
                        JOIN     vehicles
                        ON       updates.vehicle_id = vehicles.id
                        WHERE    vehicles.fleet_id = ?
                        AND      From_unixtime(updates.time) BETWEEN ? AND ?
                        GROUP BY trips.id
                        ORDER BY min(updates.time)) others
      JOIN     updates
      ON       updates.vehicle_id = vehicles.id
      AND      updates.time = others.i_time
      AND      updates.trip_id = others.trip_id
      ORDER BY vehicles.id,
               others.i_time`;
    let updates_sql_string = SqlString.format(updates_sql, [req.query.fleet_id, t_initial.toDate(), t_final.toDate()]);

    let done = function(fleet_info, vehicle_info, vehicle_updates) {
    res.render('af', {
        "fleet_info": fleet_info,
        "vehicle_info": vehicle_info,
        "vehicle_updates": vehicle_updates,
        "date": t_initial.format("M/D/YYYY")
      });
    //res.writeHead(200, {'Content-Type': 'text/plain'});
    //res.end(JSON.stringify(vehicle_updates));
    };

    pool.query(fleet_sql_string, error_handler(function(fleet_info) {
      fleet_info = fleet_info[0]; // unpack since there's only 1 row
      pool.query(vehicle_sql_string, error_handler(function(vehicle_info) {
        pool.query(updates_sql_string, error_handler(function(vehicle_updates) {
          done(fleet_info, vehicle_info, groupBy(vehicle_updates, 'vehicle_id'));
        }));
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

router.get('/rs', (req, res) => {
  if (!(req.query.stop_id && req.query.trip_id && moment(req.query.month, 'MM/YYYY').isValid())) {
    res.render('error');
  } else {
    let t_initial = moment(req.query.month, 'MM/YYYY');
    let t_final = moment(t_initial).add(1, 'months');

    let sql =
      `SELECT   vehicles.fleet_number,
               fleets.NAME                                                   AS fleet_name,
                        Concat(engines.make, ' ', engines.model)             AS engine,
                        Concat(transmissions.make, ' ', transmissions.model) AS transmission,
               liveries.NAME                                                 AS livery,
               Date_format(From_unixtime(updates.time), '%a %b %D %r')       AS time,
               updates.schedule_deviation/60                                 AS schedule_deviation
      FROM     updates
      JOIN     vehicles
      ON       updates.vehicle_id = vehicles.id
      JOIN     fleets
      ON       vehicles.fleet_id = fleets.internal_id
      JOIN     engines
      ON       fleets.engine_id = engines.internal_id
      JOIN     transmissions
      ON       fleets.transmission_id = transmissions.internal_id
      JOIN     liveries
      ON       vehicles.livery_id = liveries.internal_id
      JOIN     stops
      ON       stops.id = ?
      JOIN
               (
                        SELECT   vehicle_id,
                                 Min(Sqrt(Pow((stops.latitude - updates.latitude), 2) + Pow((stops.longitude - updates.longitude), 2))) AS distance_deviation
                        FROM     updates
                        JOIN     trips
                        ON       updates.trip_id = trips.id
                        JOIN     stops
                        ON       stops.id = ?
                        WHERE    trips.id = ?
                        AND      from_unixtime(updates.time) BETWEEN ? AND      ?
                        GROUP BY vehicle_id) u2
      WHERE    updates.vehicle_id = u2.vehicle_id
      AND      sqrt(pow((stops.latitude - updates.latitude), 2) + pow((stops.longitude - updates.longitude), 2)) = u2.distance_deviation
      AND      updates.trip_id = ?
      ORDER BY updates.time`; // stop id, stop id, trip id, start time, end time
    let sql_string = SqlString.format(sql, [req.query.stop_id, req.query.stop_id, req.query.trip_id, t_initial.toDate(), t_final.toDate(), req.query.trip_id]);

    let done = function(updates) {
      res.render('rs', {"updates": updates, "trip_id": req.query.trip_id, "month": t_initial.format("M/YYYY")});
    };

    pool.query(sql_string, error_handler(done));
  }

});

router.get('/rt', (req, res) => {
  if (!(req.query.trip_id && moment(req.query.date, 'MM/DD/YYYY').isValid())) {
    res.render('error');
  } else {
    let t_initial = moment(req.query.date, 'MM/DD/YYYY');
    let t_final = moment(t_initial).add(1, 'days');

    let route_sql =
      `SELECT routes.id,
             routes.number,
             routes.description
      FROM   routes
             JOIN trips
               ON trips.route_id = routes.id
      WHERE  trips.id = ?`;
      let route_sql_string = SqlString.format(route_sql, req.query.trip_id);

    let block_sql =
      `SELECT trips.id AS trip_id,
             routes.number AS route_number,
             trips.headsign AS headsign,
             trips.shape_id AS shape_id,
             trips.service_id AS service_id,
             trips.block_id AS block_id
      FROM   trips
             JOIN routes
               ON trips.route_id = routes.id
             JOIN updates
               ON updates.trip_id = trips.id
      WHERE  block_id = (SELECT block_id
                         FROM   trips
                         WHERE  id = ?)
      GROUP  BY trips.id
      ORDER  BY Min(updates.block_trip_sequence)`;
    let block_sql_string = SqlString.format(block_sql, req.query.trip_id);

    let vehicle_sql =
      `SELECT vehicles.id                                          AS id,
             vehicles.fleet_number,
             fleets.name                                          AS fleet_name,
             CONCAT(engines.make, ' ', engines.model)             AS engine,
             CONCAT(transmissions.make, ' ', transmissions.model) AS transmission,
             liveries.name                                        AS livery
      FROM   vehicles
             JOIN fleets
               ON vehicles.fleet_id = fleets.internal_id
             JOIN engines
               ON fleets.engine_id = engines.internal_id
             JOIN transmissions
               ON fleets.transmission_id = transmissions.internal_id
             JOIN liveries
               ON vehicles.livery_id = liveries.internal_id
             JOIN updates
               ON vehicles.id = updates.vehicle_id
      WHERE  DATE(From_unixtime(updates.TIME)) = ?
             AND updates.trip_id = ?
      GROUP  BY vehicles.id`;
    let vehicle_sql_string = SqlString.format(vehicle_sql, [t_initial.toDate(), req.query.trip_id]);

    let performance_sql =
      `SELECT   stops.agency_code     AS stop_code,
               stops.description     AS stop_description,
               updates.schedule_deviation/60 AS schedule_deviation,
               vehicles.id     AS vehicle_id,
               Date_format(From_unixtime(updates.time), '%a %b %D %r') AS time
      FROM     stops
      JOIN     (
               (
                        SELECT   stops.id,
                                 Min(Sqrt(Pow((stops.latitude - updates.latitude), 2) + Pow((stops.longitude - updates.longitude), 2))) AS distance_deviation
                        FROM     stops
                        JOIN     \`routes-stops\`
                        ON       stops.id = \`routes-stops\`.stop_id
                        JOIN     routes
                        ON       \`routes-stops\`.route_id = routes.id
                        JOIN     trips
                        ON       routes.id = trips.route_id
                        JOIN     updates
                        ON       trips.id = updates.trip_id
                        WHERE    trips.id = ?
                        AND      date(from_unixtime(time)) = ?
                        GROUP BY stops.id) u2)
      ON       stops.id = u2.id
      JOIN     updates
      ON       date(from_unixtime(updates.time)) = ?
      AND      updates.trip_id = ?
      AND      sqrt(pow((stops.latitude - updates.latitude), 2) + pow((stops.longitude - updates.longitude), 2)) = u2.distance_deviation
      JOIN     vehicles
      ON       updates.vehicle_id = vehicles.id
      ORDER BY from_unixtime(updates.time)`;
    let performance_sql_string = SqlString.format(performance_sql, [req.query.trip_id, t_initial.toDate(), t_initial.toDate(), req.query.trip_id]);

    let done = function(route_info, block_info, vehicle_info, performance_info) {
      /*res.writeHead(200, {"Content-Type": "text/plain"});
      res.write(JSON.stringify(route_info));
      res.write('\n\n');
      res.write(JSON.stringify(block_info));
      res.write('\n\n');
      res.write(JSON.stringify(vehicle_info));
      res.write('\n\n');
      res.write(JSON.stringify(groupBy(performance_info, 'vehicle_id')));
      res.write('\n\n');
      res.end();*/
      res.render('rt', {
        "trip_id": req.query.trip_id,
        "route_info": route_info[0],
        "block_info": block_info,
        "vehicle_info": vehicle_info,
        "performance_info": groupBy(performance_info, 'vehicle_id'),
        "date": t_initial.format("M/D/YYYY")
      });
    };

    pool.query(route_sql_string, error_handler(function(route_info) {
      pool.query(block_sql_string, error_handler(function(block_info) {
        pool.query(vehicle_sql_string, error_handler(function(vehicle_info) {
          pool.query(performance_sql_string, error_handler(function(performance_info) {
            done(route_info, block_info, vehicle_info, performance_info);
          }));
        }));
      }));
    }));
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
