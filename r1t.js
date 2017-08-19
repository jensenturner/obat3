let http = require('http');
let fs = require('fs');
let Seq = require('./Seq');

let route_ids = ['1_100146', '1_100177', '1_100059', '1_100214', '1_100215', '1_100224', '1_100225', '1_100259', '1_100265', '1_100273'];

let query = function() {
  let url = `http://api.pugetsound.onebusaway.org/api/where/stops-for-route/${route_seq.next()}.json?key=TEST`;
  console.log(url);
  let done = function(res) {
    switch (res.statusCode) {
      case 200:
        let raw = '';
        res.on('error', (error) => { throw error; });
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => { 
          fs.writeFile(`${route_seq.current()}.json`, raw, (err) => {
            if (err) throw err;
          });
        });
        break;
      case 429: // OBA sends 429 to mean "requests too frequent"; they won't accept anything more freq. than 15sec
        console.error('error 429 recieved, retrying');
        route_seq.retry();
        break;
      default:
        throw res.message;
    }
  };
  http.get(url, done);
};

let route_seq = new Seq(route_ids);
setInterval(query, 15000);
query();
