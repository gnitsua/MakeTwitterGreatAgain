var mysql = require("mysql");
require('dotenv').config()

function Database(){
	var pool      =    mysql.createPool({
    	connectionLimit : 100, //important
    	host     : 'localhost',
    	user     : process.env.DB_USR,
    	password : process.env.DB_PASS,
    	database : 'twitter',
    	debug    :  false
	});
	Database.prototype.select = function(table,where,order,limit1,limit2,callback) {
		pool.getConnection(function(err,con){
        	if (err) {
          		console.log("16: Error in connection database");
          		return;
        	} 
        	else{
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
					con.release();
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
			}
		});
	};
	Database.prototype.insert = function(table,data,callback) {
		pool.getConnection(function(err,con){
        	if (err) {
          		console.log("54: Error in connection database");
          		return;
        	} 
        	else{
				console.log("inserting");
				//console.log(data);
				con.query('INSERT INTO '+table+' SET ?', data, function(err,res){
					con.release();
  					if(err) throw err;
					console.log('Last insert ID:', res.insertId);
					if(callback !== undefined){
						callback(res.insertId);
					}
				});
        	}
        });
		

	};
	Database.prototype.replace = function(table,data,callback) {
		pool.getConnection(function(err,con){
        	if (err) {
          		console.log("54: Error in connection database");
          		return;
        	} 
        	else{
				console.log("replacing");
				//console.log(data);
				con.query('REPLACE INTO '+table+' SET ?', data, function(err,res){
					con.release();
  					if(err) throw err;
					console.log('Last replace ID:', res.insertId);
					if(callback !== undefined){
						callback(res.insertId);
					}
				});
        	}
        });
		

	};
	Database.prototype.update = function(table,set,where,callback) {
		pool.getConnection(function(err,con){
        	if (err) {
          		console.log("75: Error in connection database");
          		return;
        	} 
        	else{
        		//console.log('UPDATE ' + table + ' SET ' + set + ' WHERE '+ where);

        		con.query(
  					'UPDATE '+table+' SET '+set+' WHERE '+where,
  					function (err, result) {
  						con.release();
    					if (err) throw err;
						console.log('Changed ' + result.changedRows + ' rows');
						if(callback !== undefined){
							callback(result.changedRows);
						}
 					});
			}
		});
		
	};
	Database.prototype.delete = function(table,where,callback) {
		pool.getConnection(function(err,con){
        	if (err) {
          		console.log("95: Error in connection database");
          		return;
        	} 
        	else{
        		con.query(
  					'DELETE FROM '+table+' WHERE '+where,
  					function (err, result) {
  						con.release();
    					if (err) throw err;
						console.log('Deleted ' + result.affectedRows + ' rows');
						if(callback!== undefined){
							callback(result);
						}
  					});
        	}
        });
		
	};
	
	Database.prototype.count = function(table,where,callback) {
		pool.getConnection(function(err,con){
        	if (err) {
          		console.log("116: Error in connection database");
          		return;
        	} 
        	else{
				query = 'SELECT COUNT(*) AS count FROM '+table;
				if(where !== null){
					query += ' WHERE ' + where;
				}
				con.query(
  					query,
  					function (err, result) {
  						con.release();
    					if (err) throw err;
    					if(callback!== undefined){
    						callback(result);
    					}
 					});
        	}
        });
		
	};
	Database.prototype.average = function(table,where,callback) {
		pool.getConnection(function(err,con){
        	if (err) {
          		console.log("116: Error in connection database");
          		return;
        	} 
        	else{
				query = 'SELECT AVG(sed) AS average FROM '+table;
				if(where !== null){
					query += ' WHERE ' + where;
				}
				con.query(
  					query,
  					function (err, result) {
  						con.release();
    					if (err) throw err;
    					if(callback!== undefined){
    						callback(result);
    					}
 					});
        	}
        });
		
	};
}

module.exports = Database;