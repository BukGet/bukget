//Imports
var config = require('./config');
var express = require('express');
var redirect = require("express-redirect");
var mongode = require('mongode');
var bleach = require('bleach');
var ObjectID = require('mongode').ObjectID;


//Connect to database
var db = mongode.connect(config.database.host + config.database.name);
db.collection('plugins');
db.collection('webstats');
db.collection('geninfo');
db.collection('authors');
db.collection('categories');

//Common methods
var common = {
    fieldgen: function (fields, callback) {
        // Generates the field listing based on the include and exclude lists.
        var f = {
            '_id': 0
        }

        for (var i = 0; i < fields.length; i++) {
            if (fields[i] != '') {
                if (fields[i].charAt(0) == '-') {
                    f[fields[i].substr(1)] = 0
                } else {
                    f[fields[i]] = 1
                }
            }
        }

        callback(f);
    },

    list_geninfo: function (size, callback) {
        // Retrieves the last X number of generations based on the value of the size variable.
        if (size == undefined) {
            size = 1;
        }

        var data = [];
        db.geninfo.find().sort('_id', -1).limit(size).toArray(function (err, docs) {
            callback(docs);
        });
    },

    get_geninfo: function (idnum, callback) {
        // Returns a specific generation ID's information.
        db.geninfo.findOne({
            '_id': ObjectID(idnum)
        }, function (err, document) {
            callback(document);
        })
    },

    query: function (filters, fields, sort, start, size, callback) {
        // Generic query function to centralize querying the database.
        var d = 1;

        if (sort.charAt(0) == '-') {
            sort = sort.substr(1);
            d = -1;
        }

        if (size != undefined) {
            if (start == undefined) {
                start = 0;
            }
            db.plugins.find(filters, fields).sort(sort, d).skip(start).limit(size).toArray(function (err, docs) {
                callback(docs);
            })
        } else {
            db.plugins.find(filters, fields).sort(sort, d).toArray(function (err, docs) {
                if (err || docs == null) {
                    return callback(null);
                }
                callback(docs);
            })
        }
    },

    list_plugins: function (server, fields, sort, start, size, callback) {
        // Returns a list of plugins with the field specified, the list can be narrowed down to specific server binary compatability by setting it to other than undefined.
        var filters = {
            'deleted': {
                '$exists': false
            }
        };

        if (server != undefined) {
            filters['server'] = server
        }

        query(filters, fields, sort, start, size, function (the_callback) {
            callback(the_callback);
        })
    },

    list_author_plugins: function (server, author, fields, sort, start, size, callback) {
        // Returns the plugin list for a given author. Can be filtered by server binary compatability using the server variable.
        var filters = {
            'authors': author
        };

        if (server != undefined) {
            filters['server'] = server
        }

        query(filters, fields, sort, start, size, function (the_callback) {
            callback(the_callback)
        })
    },

    list_category_plugins: function (server, category, fields, sort, start, size, callback) {
        // Returns the plugin list for a given category. Can be filtered by server binary compatability using the server variable.
        var filters = {
            'categories': category
        };

        if (server != undefined) {
            filters['server'] = server
        }

        query(filters, fields, sort, start, size, function (the_callback) {
            callback(the_callback)
        })
    },

    ca_convert: function (data, callback) {
        // Reformats the data to what the API should be returning.
        var dset = [];

        for (var i = 0; i < data.length; i++) {
            dset.push({
                'name': data[i]['id'],
                'count': data[i]['value']
            });
        }

        callback(dset);
    },

    list_authors: function (callback) {
        // Returns a list of plugin authors and the number of plugins each one has created/worked on.
        db.authors.find().sort('_id').toArray(function (err, docs) {
            common.ca_convert(docs, function (the_callback) {
                callback(the_callback);
            })
        })
    },

    list_categories: function (callback) {
        // Returns a list of plugin categories and the count of plugins that fall under each category.
        db.categories.find().sort('_id').toArray(function (err, docs) {
            common.ca_convert(docs, function (the_callback) {
                callback(the_callback);
            })
        })
    },

    plugin_details: function (server, plugin, version, fields, callback) {
        // Returns the plugin details for a given plugin. Optionally will also return a specific version of the plugin in the versions list if something other than undefined is specified in the version variable.
        var filters = {
            'slug': plugin,
            'server': server
        };

        if (version != undefined && (version == 'release' || version == 'alpha' || version == 'beta')) {
            filters['versions.type'] = (version.charAt(0).toUpperCase() + version.slice(1));
            if (fields != null && fields.length != 0) {
                fields.append('versions.type');
            }
        }

        db.plugins.findOne(filters, common.fieldgen(fields), function (err, document) {
            if (err || document == null) {
                return callback(null);
            }

            if (version != undefined) {
                if (version.toLowerCase() == "latest") {
                    p['versions'] = [p['versions'][0]];
                } else if (version.toLowerCase() == "alpha" || version.toLowerCase() == "beta" || version.toLowerCase() == "release") {
                    var found = false;
                    for (var i = 0; i < p['versions'].length; i++) {
                        if (p['versions'][i]['type'].toLowerCase() == version.toLowerCase()) {
                            p['versions'] = [p['versions'][i]];
                            found = true;
                        }
                    }
                    if (!found) {
                        p['versions'] = [];
                    }
                } else {
                    var found = false;
                    for (var i = 0; i < p['versions'].length; i++) {
                        if (p['versions'][i]['version'] == version) {
                            p['versions'] = [p['versions'][i]];
                            found = true;
                        }
                    }
                    if (!found) {
                        p['versions'] = [];
                    }
                }
            }

            callback(p);
        });
    },

    plugins_up_to_date: function (plugins_list, server, callback) {
        // Takes a list of plugin slugs and returns an array of objects with the plugin and most recent version.
        var data = [];
        var slugs = [];
        for (var i = 0; i < plugins_list.length; i++) {
            slugs.push({
                'slug': plugins_list[i]
            });
        }
        db.plugins.find({
            '$or': slugs,
            'server': server
        }).toArray(function (err, docs) {
            for (var i = 0; i < docs.length; i++) {
                var entry = {
                    'slug': docs[i]['slug'],
                    'plugin_name': docs[i]['plugin_name'],
                    'versions': {
                        'latest': docs[i]['versions'][0]['version'],
                    },
                }
                for (var x = 0; x < docs[i]['versions'].length; x++) {
                    if (docs[i]['versions'][x]['type'] == 'Release' || docs[i]['versions'][x]['type'] == 'Beta' || docs[i]['versions'][x]['type'] == 'Alpha') {
                        if (entry['versions'][docs[i]['versions'][x]['type'].toLowerCase()] == null) {
                            entry['versions'][docs[i]['versions'][x]['type'].toLowerCase()] = docs[i]['versions'][x]['version'];
                        }
                    }
                }
                data.append(entry);
            }
            callback(data);
        })
    },

    plugin_search: function (filters, fields, sort, start, size, sub, callback) {
        // A generalized sort function for the database. Returns a list of plugins with the fields specified in the inclusion and exclusion variables.
        var f = {};
        if (sub == undefined) {
            sub = true;
        }
        for (var i = 0; i < filters.length; i++) {
            var item = filters[i];
            switch (item['action']) {
            case '=':
                f[item['field']] = item['value'];
                break;
            case '!=':
                f[item['field']] = {
                    '$ne': item['value']
                };
                break;
            case '<':
                f[item['field']] = {
                    '$lt': item['value']
                };
                break;
            case '<=':
                f[item['field']] = {
                    '$lte': item['value']
                };
                break;
            case '>':
                f[item['field']] = {
                    '$gt': item['value']
                };
                break;
            case '>=':
                f[item['field']] = {
                    '$gte': item['value']
                };
                break;
            case 'like':
                f[item['field']] = new RegExp(item['value'], "i");
                break;
            case 'exists':
                f[item['field']] = {
                    '$exists': true
                };
                break;
            case 'nexists':
                f[item['field']] = {
                    '$exists': false
                };
                break;
            case 'in':
                if (item['value'].isArray()) {
                    f[item['field']] = {
                        '$in': item['value']
                    }
                }
                break;
            case 'not in':
                if (item['value'].isArray()) {
                    f[item['field']] = {
                        '$nin': item['value']
                    }
                }
                break;
            case 'all':
                if (item['value'].isArray()) {
                    f[item['field']] = {
                        '$all': item['value']
                    }
                }
                break;
            case 'and':
                if (item['value'].isArray() && item['field'] == '') {
                    f['$and'] = (item['value'] == null ? sub : item['value']);
                }
                break;
            case 'or':
                if (item['value'].isArray() && item['field'] == '') {
                    f['$or'] = (item['value'] == null ? sub : item['value']);
                }
                break;
            case 'nor':
                if (item['value'].isArray() && item['field'] == '') {
                    f['$nor'] = (item['value'] == null ? sub : item['value']);
                }
                break;
            case 'not':
                if (item['value'].isArray() && item['field'] == '') {
                    f['$not'] = (item['value'] == null ? sub : item['value']);
                }
                break;
            }

            if (sub) {
                return callback(f);
            }

            common.query(f, fields, sort, start, size, function (the_callback) {
                callback(the_callback);
            })
        }

    }
};

//Initialize express app
var app = express();
redirect(app);

//Define middleware for setting headers
app.use(function (req, res, next) {
    res.header('Content-Type', 'application/json');
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

//Add express middlewares
app.use(express.bodyParser())
app.use(app.router);

//Include api handlers
require('./v3')(app, db, bleach, common);
require('./v2')(app, db, bleach, common);
require('./v1')(app, db, bleach, common);

//Setup redirects
app.redirect('/', '/3');

app.redirect('/api', '/1');
app.redirect('/api/:query', '/1/:query');

app.redirect('/api2', '/2');
app.redirect('/api2/:query', '/2/:query');

//Handle stats requests
app.get('/stats/naughty_list', function (req, res) {
    db.plugins.find({ '_use_dbo': { '$exists': True } }, {
        '_id': 0,
        'slug': 1,
        'plugin_name': 1,
        'authors': 1,
    }).toArray(function (err, docs) {
        if (err) {
            return res.status(500);
        }

        res.jsonp(docs);
    });
});

app.get('/stats/todays_trends', function (req, res) {
    db.plugins.find({}, {
        'slug': 1,
        'versions.version': 1
    }).toArray(function (err, plugins) {
        if (err) {
            return res.status(500);
        }

        var pcount = plugins.length;
        var vcount = 0;

        for (plugin in plugins) {
            vcount += plugins[plugin]['versions'].length;
        }

        res.jsonp({
            'plugin_count': pcount,
            'version_count': vcount
        });
    });
});

app.get('/stats/trend/:days', function (req, res) {
    db.webstats.find({}, {
        '_id': 0,
        'plugins': 0
    }).sort('_id', -1).limit(parseInt(req.params.days)).toArray(function (err, docs) {
        if (err) {
            return res.status(500);
        }

        res.jsonp(docs);
    });
});

app.get('/stats/trend/:days/:names', function (req, res) {
    var fields = {
        '_id': 0,
        'timestamp': 1
    }

    var plugins = bleach.sanitize(req.params.names).split(',');
    var index = 0;

    for (index; index < plugins.length; index++) {
        fields['plugins.' + plugins[index]] = 1;
    }

    db.webstats.find({}, fields).sort('_id', -1).limit(parseInt(req.params.days)).toArray(function (err, docs) {
        if (err) {
            return res.status(500);
        }

        res.jsonp(docs);
    });
});

//Start webserver
app.listen(config.port, config.address);