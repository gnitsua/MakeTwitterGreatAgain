var mysql = require("mysql");
require('dotenv').config()

function Database(){
	Database.prototype.select = function(table,where,order,limit1,limit2,callback) {
		var con = mysql.createConnection({
  			host: "localhost",
  			user: process.env.DB_USR,
  			password: process.env.DB_PASS,
			database: "twitter"
		});
		
		query = 'SELECT * FROM '+table;
		if(where !== null){
			query += ' WHERE ' + where; 
		}
		if(order !== null){
			query += ' ORDER BY ' + order + ' DESC';
		}
		if(limit1 !== null){
			query += ' LIMIT ' + limit1;
		}
		if(limit2 !== null){
			query += ','+limit2;
		}
		console.log(query);
		con.query(query,function(err,rows){
	  		if(err){
	  			console.log("error selecting from database");
	  			console.log(err);
	  			if(callback!== undefined){
	  				callback();
	  			}
	  		}
	  		else{
	  			if(callback!== undefined){
	  				callback(rows);
	  			}
	  		}
		});
		con.end(function(err) {
		  // The connection is terminated gracefully
		  // Ensures all previously enqueued queries are still
		  // before sending a COM_QUIT packet to the MySQL server.
		});
	};
	Database.prototype.insert = function(table,data,callback) {
		var con = mysql.createConnection({
  			host: "localhost",
  			user: process.env.DB_USR,
  			password: process.env.DB_PASS,
			database: "twitter"
		});
		console.log("inserting");
		//console.log(data);
		con.query('INSERT INTO '+table+' SET ?', data, function(err,res){
  			if(err) throw err;
			console.log('Last insert ID:', res.insertId);
			if(callback !== undefined){
				callback(res.insertId);
			}
		});
		con.end(function(err) {
		  // The connection is terminated gracefully
		  // Ensures all previously enqueued queries are still
		  // before sending a COM_QUIT packet to the MySQL server.
		});
	};
	Database.prototype.update = function(table,set,where,callback) {
		var con = mysql.createConnection({
  			host: "localhost",
  			user: process.env.DB_USR,
  			password: process.env.DB_PASS,
			database: "twitter"
		});
		con.query(
  			'UPDATE '+table+' SET '+set+' Where '+where,
  			function (err, result) {
    			if (err) throw err;
				console.log('Changed ' + result.changedRows + ' rows');
				if(callback!== undefined){
					callback(result.changedRows);
				}
 			 }
		);
		con.end(function(err) {
		  // The connection is terminated gracefully
		  // Ensures all previously enqueued queries are still
		  // before sending a COM_QUIT packet to the MySQL server.
		});
	};
	Database.prototype.delete = function(table,where,callback) {
		var con = mysql.createConnection({
  			host: "localhost",
  			user: process.env.DB_USR,
  			password: process.env.DB_PASS,
			database: "twitter"
		});
		con.query(
  			'DELETE FROM '+table+' WHERE '+where,
  			function (err, result) {
    			if (err) throw err;
				console.log('Deleted ' + result.affectedRows + ' rows');
				if(callback!== undefined){
					callback(result);
				}
  			}
		);
		con.end(function(err) {
		  // The connection is terminated gracefully
		  // Ensures all previously enqueued queries are still
		  // before sending a COM_QUIT packet to the MySQL server.
		});
	};
	
	Database.prototype.count = function(table,where,callback) {
		var con = mysql.createConnection({
  			host: "localhost",
  			user: process.env.DB_USR,
  			password: process.env.DB_PASS,
			database: "twitter"
		});
		query = 'SELECT COUNT(*) AS count FROM '+table;
		if(where !== null){
			query += ' WHERE ' + where;
		}
		con.query(
  			query,
  			function (err, result) {
    			if (err) throw err;
    			if(callback!== undefined){
    				callback(result);
    			}
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