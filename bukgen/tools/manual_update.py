#!/usr/bin/env python
import pymongo
import json
import os
from bukgen.base import genlog
from bukgen.base import config
from bson.objectid import ObjectId

def manual_update():
    connection = pymongo.MongoClient(config.get('Settings', 'database_host'), 
                                     config.getint('Settings', 'database_port'))
    db = connection.bukget
    fixpath = config.get('Settings', 'json_fix')
    if os.path.exists(fixpath):
        for fname in os.listdir(fixpath):
            fname = os.path.join(fixpath, fname)
            with open(fname) as jfile:
                updated = json.loads(jfile.read())
            oid = db.plugins.find_one({'slug': update['slug'], 'server': updated['server']})['_id']
            updated['_id'] = oid
            print 'Updating %s using ObjectId %s' % (update['slug'], oid)
            db.plugins.save(updated)
            os.path.remove(fname)

if __name__ == '__main__':
    manual_update()