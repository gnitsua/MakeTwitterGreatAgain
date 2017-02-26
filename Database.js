var mysql = require("mysql");

function Database(){
	Database.prototype.select = function(table,where,limit1,limit2,callback) {
		var con = mysql.createConnection({
  			host: "localhost",
  			user: "root",
  			password: "CS275",
			database: "twitter"
		});
		console.log("select "+where+" from "+table);
		if(where === null){
			if(limit1 === null && limit2 === null){
				con.query('SELECT * FROM '+table,function(err,rows){
	  				if(err){
	  					console.log("error selecting from database");
	  					console.log(err);
	  					callback();
	  				}
	  				else{
	  					callback(rows);
	  				}
				});
			}
			else{
				console.log(limit1+':'+limit2)
				con.query('SELECT * FROM '+table+' LIMIT '+limit1+','+limit2,function(err,rows){
		  			if(err){
		  				console.log("error selecting from database");
		  				console.log(err);
		  				callback();
		  			}
		  			else{
		  				callback(rows);
		  			}
				});
			}
		}
		else{
			if(limit1 === null && limit2 === null){
				con.query('SELECT * FROM '+table+' WHERE '+ where,function(err,rows){
		  			if(err){
		  				console.log("error selecting from database")
		  				console.log(err);
		  				callback();
		  			}
		  			else{
		  				callback(rows);
		  			}
				});
			}
			else{
				if(limit1 !== null && limit2 !== null){
					console.log('SELECT * FROM '+table+' WHERE '+ where+' LIMIT '+limit1+','+limit2)
					con.query('SELECT * FROM '+table+' WHERE '+ where+' LIMIT '+limit1+','+limit2,function(err,rows){
		  				if(err){
		  					console.log("error selecting from database")
		  					console.log(err);
		  					callback();
		  				}
		  				else{
		  					callback(rows);
		  				}
					});
				}
				else{
					console.log("not implimented")
					callback([]);
				}
			}
		}
		con.end(function(err) {
		  // The connection is terminated gracefully
		  // Ensures all previously enqueued queries are still
		  // before sending a COM_QUIT packet to the MySQL server.
		});
	};
	Database.prototype.insert = function(table,data) {
		var con = mysql.createConnection({
  			host: "localhost",
  			user: "root",
  			password: "CS275",
			database: "twitter"
		});
		console.log("inserting");
		//console.log(data);
		con.query('INSERT INTO '+table+' SET ?', data, function(err,res){
  			if(err) throw err;
			console.log('Last insert ID:', res.insertId);
		});
		con.end(function(err) {
		  // The connection is terminated gracefully
		  // Ensures all previously enqueued queries are still
		  // before sending a COM_QUIT packet to the MySQL server.
		});
	};
	Database.prototype.update = function(table,set,where) {
		var con = mysql.createConnection({
  			host: "localhost",
  			user: "root",
  			password: "CS275",
			database: "twitter"
		});
		con.query(
  			'UPDATE '+table+' SET '+set+' Where '+where,
  			function (err, result) {
    			if (err) throw err;
					console.log('Changed ' + result.changedRows + ' rows');
 			 }
		);
		con.end(function(err) {
		  // The connection is terminated gracefully
		  // Ensures all previously enqueued queries are still
		  // before sending a COM_QUIT packet to the MySQL server.
		});
	};
}

module.exports = Database;