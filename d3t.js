//Daemon - OBAT3
// Jensen Turner

const http = require('http');
const mysql = require('mysql');
const Seq = require('./Seq');
const SqlString = require('sqlstring');

//-OPTIONS
const db_credentials = {
  host: "localhost",
  user: "root",
  password: "qwertyuiop[]\\",
  database: "obat3"
};

const request_interval = 15000;
const agency_check_seq = [1, 97, 3, 40, 97, 3];
//-END OPTIONS

let pool = mysql.createPool(db_credentials);

// generic handling of errors from database callbacks
let error_handler = function(done) {
  return function(error, results, fields) {
    if (error) throw error;
    if (done) done(results, fields);
  };
};

//update functions - each stores a particular OBA reference datatype
//for more information: http://developer.onebusaway.org/modules/onebusaway-application-modules/current/api/where/index.html
let update_agencies = function(agencies) {
  if (agencies.length < 1) {
    console.log('\tno agency updates available');
    return;
  }

  let sql = 'INSERT IGNORE INTO agencies(id, name) VALUES ?';

  let agency_records = [];
  for (let agency of agencies) {
    agency_records.push([agency.id, agency.name]);
  }

  let done = function(results, fields) {
    console.log(`\t${results.affectedRows} agencies inserted`);
  };

  let sql_string = SqlString.format(sql, [agency_records]);

  pool.query(sql_string, error_handler(done));
};

let update_routes = function(routes) {
  if (routes.length < 1) {
    console.log('\tno route updates available');
    return;
  }

  let sql = 'INSERT IGNORE INTO routes(id, agency_id, number, description) VALUES ?';

  let route_records = [];
  for (let route of routes) {
    // one of many discrepancies between agencies on how data is stored - route desc in longName for most but description for KCM
    if (route.agencyId == '1' || typeof route.longName === 'undefined' || !route.longName) {
      route_records.push([route.id, route.agencyId, route.shortName, route.description]);
    } else {
      route_records.push([route.id, route.agencyId, route.shortName, route.longName]);
    }
  }

  let done = function(results, fields) {
    console.log(`\t${results.affectedRows} routes inserted`);
  };

  let sql_string = SqlString.format(sql, [route_records]);

  pool.query(sql_string, error_handler(done));
};

let update_stops = function(stops) {
  if (stops.length < 1) {
    console.log('\tno stop updates available');
    return;
  }

  // N:M relationship of stops to routes and references are found on OBA stop objects
  // must be put in their own table

  let stop_sql = 'INSERT IGNORE INTO stops(id, latitude, longitude, direction, description, agency_code, agency_id) VALUES ?';
  let route_stop_sql = 'INSERT IGNORE INTO `routes-stops`(route_id, stop_id) VALUES ?';

  let stop_records = [];
  let route_stop_records = [];
  for (let stop of stops) {
    stop_records.push([stop.id, stop.lat, stop.lon, stop.direction, stop.name, stop.code, stop.id.split('_')[0]]);
    for (let route_id of stop.routeIds) {
      route_stop_records.push([route_id, stop.id]);
    }
  }

  let done = function(results, fields) {
    console.log(`\t${results.affectedRows} stops inserted`);
  };

  let stop_sql_string = SqlString.format(stop_sql, [stop_records]);
  //console.log(stop_sql_string);
  //console.log('\n');

  let route_stop_sql_string = SqlString.format(route_stop_sql, [route_stop_records]);
  //console.log(route_stop_sql_string);
  //console.log('\n');

  pool.query(stop_sql_string, error_handler(done));
  if (route_stop_records.length > 0) {
    pool.query(route_stop_sql_string, error_handler());
  }
};

let update_trips = function(trips) {
  if (trips.length < 1) {
    console.log('\tno trip updates available');
    return;
  }

  let sql = 'INSERT IGNORE INTO trips(id, block_id, shape_id, service_id, direction_id, route_id, headsign, agency_id) VALUES ?';

  let trip_records = [];
  for (let trip of trips) {
    trip_records.push([trip.id, trip.blockId, trip.shapeId, trip.serviceId, trip.directionId, trip.routeId, trip.tripHeadsign, trip.id.split('_')[0]]);
  }

  let done = function(results, fields) {
    console.log(`\t${results.affectedRows} trips inserted`);
  };

  let sql_string = SqlString.format(sql, [trip_records]);

  pool.query(sql_string, error_handler(done));
};

// main update function
let update = function(data) {
  // take care of references first
  update_agencies(data.references.agencies);
  update_routes(data.references.routes);
  update_stops(data.references.stops);
  update_trips(data.references.trips);

  if (data.list.length < 1) {
    console.log('\tno vehicle updates available');
    return;
  }

  let sql = 'INSERT IGNORE INTO updates(vehicle_id, time, latitude, longitude, trip_id, schedule_deviation, next_stop_id, \
                                        next_stop_time_offset, orientation, block_trip_sequence, scheduled_distance_along_trip, \
                                        total_distance_along_trip, distance_along_trip) VALUES ?';
  let update_records = [];
  for (let update of data.list) {
    // nulls where no data. random workarounds due to unstandardized objects
    let update_record = [update.vehicleId, update.lastUpdateTime / 1000];
    if (update.location) {
      update_record.push(update.location.lat, update.location.lon);
    } else if (update.tripStatus && update.tripStatus.location) {
      update_record.push(update.tripStatus.location.lat, update.tripStatus.location.lon);
    } else {
      update_record.push(null, null);
    }
    if (update.tripStatus) {
      update_record.push(update.tripId);
      update_record.push(update.tripStatus.scheduleDeviation);
      update_record.push(update.tripStatus.nextStop);
      update_record.push(update.tripStatus.nextStopTimeOffset);
      update_record.push(update.tripStatus.orientation);
      update_record.push(update.tripStatus.blockTripSequence);
      update_record.push(update.tripStatus.scheduledDistanceAlongTrip);
      update_record.push(update.tripStatus.totalDistanceAlongTrip);
      update_record.push(update.tripStatus.distanceAlongTrip);
    } else {
      update_record.push(null, null, null, null, null, null, null, null, null);
    }
    update_records.push(update_record);
  }

  let done = function(results, fields) {
    console.log(`\t${results.affectedRows} vehicles updated`);
  };

  let sql_string = SqlString.format(sql, [update_records]);
  pool.query(sql_string, error_handler(done));
}


let seq = new Seq(agency_check_seq);
let loop = function() {
  let url = `http://api.onebusaway.org/api/where/vehicles-for-agency/${seq.next()}.json?key=TEST`;
  console.log(`for agency ${seq.current()}:`);
  let req_sent = function(res) {
    switch (res.statusCode) {
      case 200:
        let raw = '';
        res.on('error', (error) => { throw error; });
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => { let data = JSON.parse(raw).data; /*console.log('\n\n' + raw + '\n\n');*/ update(data); });
        break;
      case 429: // OBA sends 429 to mean "requests too frequent"; they won't accept anything more freq. than 15sec
        console.error('error 429 recieved, retrying');
        seq.retry();
        break;
      default:
        throw res.message;
    }
  };
  http.get(url, req_sent);
};

//start
setInterval(loop, request_interval);
loop();
