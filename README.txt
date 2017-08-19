OBAT 3 README
Installation:
Requires MySQL (dump provided) and NodeJS. Designed to be run under systemd on linux. 
Options in both main files - i2t.js, the interface/frontend, and d3t.js, the daemon/backend, pertain to the database
configuration and will need tweaking. They are located in one object near the top of the file.
Tested under Ubuntu Zesty and Trusty-on-Windows.
No NPM package.json is provided, but the node_modules folder is already populated.

Install all dependencies, then configure systemd or alternative to run
	/usr/bin/node /path/to/obat/d3t.js (auto restart; time before restart 17sec)
	/usr/bin/node /path/to/obat/i2t.js (auto restart)
in background. (sammple systemd .service files included)
The run-as user must have sufficient privileges to read and traverse files in the obat root directory.
Aside from tailing journald or comparable, daemon can be tested by watching the count
of the updates table. The web interface binds by default to port 8080 to allow it to be run
with a minimum of privileges.

The daemon obtains new data from OneBusAway and stores it in the database.
The interface exposes and organizes the data through a simple web site.

The majority of the functionality is in the two main files.
The other files are mostly supporting content and templates for the website.

Once the programs are up and running the best way to test is to mess around with query strings passed to the website.
Using the interface and watching closely should clue you in to how data is passed by GET requests.

MySQL dump at-
https://drive.google.com/file/d/0B79XIS6fg75VWHRtS0NKNmU1cVE/view?usp=sharing

Much of HTML/CSS from Twitter Bootstrap examples at http://getbootstrap.com/examples


UPDATED GRADING RUBRIC
/ 40  Total ( –     pts. late; 2pts/day) 

    / 2 Grading Rubric
      / 2 Rubric is complete and turned in on time.

    / 18  External Correctness
      / 3 Daemon collects data continuously
/ 3 Daemon handles errors (e.g. HTTP 429) appropriately.
      / 3 Website properly exposes interface for accessing trip history
      / 3   Website properly exposes interface for accessing route history
      / 3 Website properly exposes interface for accessing vehicle history
      / 2 Website is well-designed and practical
      / 3 Edge cases (non-existent IDs) handled gracefully

    / 15  Internal Correctness
      / 3 Proper procedural decomposition/scoping/etc.
      / 3 Proper use of libraries
      / 3 Data storage implemented efficiently and normally
      / 3 Data retrieval implemented efficiently
      / 3 Proper security (character escaping, principle of least privilege, etc.)

    / 5 Style and Documentation
      / 3   Proper use of comments and documentation
      / 2   Proper casing, indentation, general coding style

