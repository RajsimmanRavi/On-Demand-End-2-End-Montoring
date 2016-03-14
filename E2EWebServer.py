#!  /usr/bin/python
""" ************************************************************
  --> Main E2E Web Server  
  --> Author: Rajsimman Ravichandiran 
  --> Last Updated: Jan 11, 2016

    ************************************************************ 
"""

import tornado.ioloop
import tornado.web
import tornado.httpserver
import tornado.options
import tornado.websocket
from tornado import autoreload
import os
import subprocess
import datetime
import time
import sqlite3
import random
import logging 
import csv
import shutil
from tornado.options import define, options
import re
#define("port", default = 8888, help = "port to run on", type = int) # This is for final version
define("port", default = 8000, help = "port to run on", type = int) # Testing version

# Implement The Logging Functionality
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# create a file handler
handler = logging.FileHandler('/var/e2emonitoring/E2EWebServer/log/server_logs.log')
handler.setLevel(logging.INFO)

# create a logging format
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)

# add the handlers to the logger
logger.addHandler(handler)

# In-Memory SQL Database for managing PPPoE Sessions and Tester Sessions
try: 
    con = sqlite3.connect(":memory:")
    cur = con.cursor()
    cur.execute("CREATE TABLE currUsers(user TEXT, [timestamp] timestamp);");
    cur.execute("CREATE TABLE pppoeSessions (user TEXT, pppoeSession TEXT);")
except Exception as e:
    raise e
    logger.error('Error on SQL DB Creation: '+str(e))

# Class for handling Admin web page stuff (Authentication, Getting info etc.)
class AdminSessionHandler(tornado.web.RequestHandler):
    def get(self):
        try:
            errormessage = self.get_argument("error")
        except:
            errormessage = ""
        self.render("login.html", errormessage = errormessage)
        
    def check_permission(self, password, username):
        if username == "admin" and password == "admin":
            return True
        return False

    def post(self):
        data = []
        userData = [] # List used to store Userids and timestamps retrieved from the In-memory database
        pppoeSessionsData = [] # List used to store pppoeInfo reyrieved from the In-memory database

        username = self.get_argument("username", "")
        password = self.get_argument("password", "")
        
        # Call auth function to authenticate user
        try:
            auth = self.check_permission(password, username)
        except Exception as e:
            error_msg = u"?error=" + tornado.escape.url_escape("Authentication failed: "+str(e)+". Please Try Again!")
            logger.error("AUTH Failed: "+str(e))
            self.redirect(u"/auth/login/" + error_msg)

        if auth:

            # Get Current PPPoE Sessions
            try:
                currPPPoESessions = self.getCurrPPPoESessions()
            except Exception as e:
                error_msg = u"?error=" + tornado.escape.url_escape("Couldn't retrieve Current PPPoE Sessions:"+str(e)+" Please Try Again! ")
                logger.error("Failed to retrieve Current PPPoE Sessions: "+str(e)) #log 
                self.redirect(u"/auth/login/" + error_msg)
            finally:
                """ currPPPoESessions holds the pppoe sessions along with the usernames associated with the sessions
                format: ifcfg-ppp0 b1test04 link-down
                        ifcfg-ppp1 b1test04 206.43.87.89
                """
                pppList = currPPPoESessions.split("\n") # Now pppList format is: ["ifcfg-ppp0 b1test04 link-down","ifcfg-pp1 b1test04 206.43.87.89"]
                

                if pppList: # make sure list isn't empty
                    for ppp in pppList:
                        if ppp: # make sure the value is not empty
                            ifcfgPPPoe = ppp.split(" ")[0]
                            pppoeSession = ifcfgPPPoe.split("-")[1]
                            pppoeSessionInfo = { 'pppoeSession': pppoeSession,
                                'username': ppp.split(" ")[1],
                                'ipAddr' : ppp.split(" ")[2]
                            }
                            data.append(pppoeSessionInfo)
                else:
                    data = ""

                try:
                    pppoeUsersData = self.getInMemDBData('currUsers')
                    pppoeSessionsData =  self.getInMemDBData('pppoeSessions')
                except Exception as e:
                    error_msg = u"?error=" + tornado.escape.url_escape("Couldn't retrieve Current PPPoE Sessions and Users:"+str(e)+" Please Try Again! ")
                    logger.error("Failed to retrieve Current PPPoE Sessions from DB Tables: "+str(e)) #log 
                    self.redirect(u"/auth/login/" + error_msg)

                self.render("admin.html", pppoeInfo = data, pppoeUsersInfo = pppoeUsersData, pppoeSessionsInfo = pppoeSessionsData)
        else:
            error_msg = u"?error=" + tornado.escape.url_escape("Login incorrect")
            self.redirect(u"/auth/login/" + error_msg)

    def getCurrPPPoESessions(self):
        try:
            output = subprocess.check_output(["/var/e2emonitoring/shellScripts/./currPPPoESessions.sh"],stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError, e:
            logger.error(str(e.output))
            output = e.output
        
        return output

    def getInMemDBData(self, tableName):
        data = []
        
        # fetch from In-Memory DB
        try:
            cur.execute("Select * from "+tableName+";")
            currData = cur.fetchall()
            for info in list(currData):
                pppoeUsersInfo = { 'pppoeUserId': str(info[0]), 
                    'info': str(info[1])
                }
                data.append(pppoeUsersInfo)
        except sqlite3.Error as e:
            data = "Error occurred: "+str(e.args[0])
            logger.error(str(e.args[0]))
        
        return data

""" ****************************************************************
    
    Class for handling Tester Sessions (Access/Leave E2E On-Demand Web Page) 
    
    ****************************************************************
"""
class TesterSessionHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print "open: new Tester Sesion"

    def on_message(self,data):
        instr = data.split(":")[0] # could be for new session or closing the session (i.e. instr could be 'new' or 'close')   
        
        # new Tester accesses the web server 
        if instr == "new":

            userSession = str("%0.6d" % random.randint(0,999999))

            try:
                cur.execute('''INSERT INTO currUsers (user,timestamp) VALUES (?,?) ''',(userSession,datetime.datetime.now()))
                con.commit()

                # Just verifying...remove it after
                print "After inserting the current User, the database now contains: "
                self.print_currDB_Data('currUsers')
                
            except sqlite3.Error, e:
                error = "Error occurred when inserting row for new User: %s:"% e.args[0]
                logger.error(error)
                self.write_message(error) 
            finally:
                self.write_message(str(userSession))
        
        else:
            """
                Things to do when a user closes the browser
                1. Get the pppoeSessions associated with the user from the PPPoESessions Table and send \n
                   them to cleanup script to stop and delete those PPPoe Sessions
                2. Remove the user from the Users Table of the DB
                3. Remove those pppoeSessions records from the PPPoESessions table 
            """
            testerSessionToClose = data.split(":")[1] #received from javascript
            
            # No. 1 
            
            try:
                cur.execute('''Select pppoeSession from pppoeSessions where user = '''+str(testerSessionToClose))
                currSessions = cur.fetchall()
                print "The User has these pppoeSessions currently in the database"
                print str(currSessions)
                pppNames = ""
                for info in list(currSessions):
                    if pppNames: # names already inserted
                        pppNames=pppNames+","+str(info[0])
                    else: #The first name
                        pppNames = str(info[0])
                
                print str(pppNames)
            except sqlite3.Error, e:
                error = "Error occurred when retrieving pppoe sessions for a specific user: %s:"% e.args[0]
                logger.error(error)

            # Send the PPPoE Sessions info to clean up 
            try:
                output = subprocess.check_output(["/var/e2emonitoring/shellScripts/./cleanUpSessions.sh", pppNames ],stderr=subprocess.STDOUT)
            except subprocess.CalledProcessError, e:
                logger.error(str(e.output))
                output = e.output
            
            # No. 2 & 3
            try:  
                cur.execute('''Delete from currUsers where user = '''+str(testerSessionToClose))
                cur.execute('''Delete from pppoeSessions where user = '''+str(testerSessionToClose))
                con.commit()
            except sqlite3.Error, e:
                error = "Error occurred when deleting user from table: %s:"% e.args[0]
                logger.error(error) 
            finally:

                print "After deleting the current User, the database now contains: "
                self.print_currDB_Data('currUsers')
                
                print "After deleting the pppoeSessions, the database now contains: "
                self.print_currDB_Data('pppoeSessions')

    def print_currDB_Data(self, tb_name):
        cur.execute("Select * from "+tb_name+";")
        currData = cur.fetchall()
        for info in list(currData):
            print str(info)

    def on_close(self):
        self.close()

""" ****************************************************************
    
    Query 7750 (DEPRACATED AND NOT BEING USED) 
    
    ****************************************************************
"""
class Query7750SessionHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print "new connection"

    def on_message(self,data):
        queryOutput = subprocess.Popen(["expect", "/var/e2emonitoring/shellScripts/exp_telnet_7750.exp"], stdout=subprocess.PIPE).communicate()[0]
        print queryOutput

        self.write_message(queryOutput)

    def close(self):
        print 'connection closed'
        self.close()

 
""" ****************************************************************
    
    Class for Handling PPPoE Sessions (Creation, Testing, Deletion) 
    
    ****************************************************************
"""
class PPPoESessionHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print "new connection"

    def on_message(self, data):
        print data 
        dataList = data.split(":")
        instr = dataList[0]
        numPPPoE = dataList[1] 
        """
        numPPPoE may have argument info for Creating PPPoE Session or Testing scenario. 
        --> Create PPPoE Session Scenario: create:b1test04,xxxxx,300,True (2nd last # is vlan_id, last says whether Default User Credentials or not)
        --> Testing Scenario: test:1,DIG,cbc.ca
        --> Delete Scenario: delete:user:0 or delete:session:0 or delete:all:ppp0
        """
        
        if instr == "create": 
            
            numPPPoEList = numPPPoE.split(",")
            username = numPPPoEList[0]
            password = numPPPoEList[1]
            tester_session = numPPPoEList[2]
            vlan_id = numPPPoEList[3]
            defaultUser= numPPPoEList[4]
            print "vlan_id: "+str(vlan_id)
            print "username: "+str(username)
            print "password: "+str(password)
            print "defaultUser: "+str(defaultUser)

            if defaultUser == "true":
                username="b1test04"
                password="bb123456"

            with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
                fout.write('')
                p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./choosePPPoECreateScript.sh", username, password, vlan_id], stdout=fout, stderr=fout).communicate()[0]

            # Gets the newly created pppoeSession, along with the username and ip Address 
            # This info will be used to create a row on the PPPoE Sessions Sumary Table 
            # Also used to create a row in sqlite db to map the current user to the created pppoe Session
            # Format of pppoeSessionName -> <pppoeSession>:<username>:<ipAddr> (ex. ppp2:b1test04:)
            pppoeSessionName = subprocess.Popen(["/var/e2emonitoring/shellScripts/./newCreatedPPPoESession.sh"], stdout=subprocess.PIPE).communicate()[0]
            pppoeSessionName = pppoeSessionName.rstrip() # remove \n from the string
            print "pppoeSessionName is: "+str(pppoeSessionName)
      
	    # This is to split the pppoe session number from the 'ppp'
            match = re.match(r"([a-z]+)([0-9]+)", pppoeSessionName, re.I)
	    if match:
    	        items = match.groups()
    		# items is ("foo", "21")
	    pppNum = items[1]

            with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
                fout.write('')
                p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./startSpecificPPPoESession.sh", pppNum], stdout=fout, stderr=fout).communicate()[0]

            read_log= subprocess.Popen(["cat", "/var/e2emonitoring/shellScripts/currpppLog"], stdout=subprocess.PIPE).communicate()[0]
            
            # This one is for logging all the PPPoE Sessions output for debugging purposes
            with open("/var/e2emonitoring/shellScripts/pppLog", 'a') as fout:
                fout.write("---"+str(datetime.datetime.now())+"---")
                fout.write(str(read_log))

            if "Link seems to have not started yet" not in read_log:
                cur.execute('''INSERT INTO pppoeSessions (user,pppoeSession) VALUES (?,?) ''',(tester_session,pppoeSessionName))

            #RR: Just for debugging purposes
            cur.execute("Select * from pppoeSessions;")
            currData = cur.fetchall()

            for info in list(currData):
                print str(info)

            send_data = str(read_log)+"*"+str(pppoeSessionName)+"*"+str(username)
            self.write_message(send_data)

        elif instr == "test":
            pppoeSession = numPPPoE.split(",")[0]
            testOption = numPPPoE.split(",")[1]
            domain = numPPPoE.split(",")[2]

            try:
                testOutput = subprocess.check_output(["/var/e2emonitoring/shellScripts/./testSpecificPPPoESessions.sh", pppoeSession, testOption, domain],stderr=subprocess.STDOUT)
            except subprocess.CalledProcessError, e:
                print "error: "+str(e.output)
                testOutput = e.output
                
            print testOutput
            
            self.write_message(str(testOutput))
        else: #delete PPPoE script

            if "all" in numPPPoE:
                pppName = dataList[2]
                print pppName
                 # stop and delete PPPoE session if running

                try:
                    output = subprocess.check_output(["/var/e2emonitoring/shellScripts/./cleanUpSessions.sh", pppName],stderr=subprocess.STDOUT)
                except subprocess.CalledProcessError, e:
                    print "error: "+str(e.output)
                    logger.error(str(e.output))
                    output = e.output
                    self.write_message("Error: "+e.output)

                self.write_message("Deleted PPPoE Session Successfully!")
            elif "user" in numPPPoE:
                userId = dataList[2]
                
                try:
                    cur.execute('''Delete from currUsers where user = '''+str(userId))
                    con.commit()
                except sqlite3.Error, e:
                    error_output = "error: "+str(e.args[0])
                    logger.error(error_output)
                    output = error_output
                    self.write_message("Error: "+error_output)
                finally:
		            self.write_message("Deleted Successfully!")
            else:
                print str(dataList)
                userId = dataList[2]
                pppName = dataList[3]

                try:
                    output = subprocess.check_output(["/var/e2emonitoring/shellScripts/./cleanUpSessions.sh", pppName],stderr=subprocess.STDOUT)
                except subprocess.CalledProcessError, e:
                    print "error: "+str(e.output)
                    logger.error(str(e.output))
                    output = e.output
                    self.write_message("Error: "+e.output)

                try:
                    # delete from Database 
                    cur.execute('''Delete from pppoeSessions where user = '''+str(userId))
                except sqlite3.Error, e:
                    error_output = "error: "+str(e.args[0])
                    logger.error(error_output)
                    output = error_output
                    self.write_message("Error: "+error_output)

                self.write_message("Deleted Successfully!")

    def print_currDB_Data(self, tb_name):
        cur.execute("Select * from "+tb_name+";")
        currData = cur.fetchall()
        for info in list(currData):
            print str(info)

    def on_close(self):
        print 'connection closed'
        self.close()

""" ****************************************************************
    
    Class for Handling PPPoE Sessions (Creation, Testing, Deletion) 
    
    ****************************************************************
"""
class SpeedTestHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print "new connection"

    def on_message(self, data):
        print data 
        dataList = data.split(":")
        speedTest_server = dataList[0]
        src_ip_addr = dataList[1]

        try:
            testOutput = subprocess.check_output(["speedtest-cli","--source",src_ip_addr,"--server",speedTest_server],stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError, e:
            print "error: "+str(e.output)
            testOutput = e.output
                
        #print testOutput
          
        self.write_message(str(testOutput))


    def on_close(self):
        print "connection closed"


""" ****************************************************************
    
    Class for Handling Changes to BRAS List Entry 
    
    ****************************************************************
"""
class ChangeBRASEntrySessionHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print "new connection"

    def on_message(self,data):
        # Expected data format: innerVLAN:new_bras_name:new_bras_IP
        print data 
        dataList = data.split(":")
        innerVLAN = dataList[0]
        new_name = dataList[1]
        new_ip = dataList[2]

        try: 
            r = csv.reader(open('/var/e2emonitoring/E2EWebServer/static/OntarioBRASList.csv'))
            rows = [row for row in r]

            for row in rows:
                if row[3] == innerVLAN:
                    row[0] = new_name
                    row[1] = new_ip

            writer = csv.writer(open('/var/e2emonitoring/E2EWebServer/static/OntarioBRASList_tmp.csv', 'w'))
            writer.writerows(rows)
        except csv.Error, e:
            self.write_message("Error: "+e.args[0])

        try:
            shutil.move("/var/e2emonitoring/E2EWebServer/static/OntarioBRASList_tmp.csv", "/var/e2emonitoring/E2EWebServer/static/OntarioBRASList.csv")
        except shutil.Error, e:
            self.write_message("Error: "+e.args[0])

        self.write_message("Successfully Modified BRAS List")

    def close(self):
        print 'connection closed'
        self.close()

""" ****************************************************************
    
    Class for Adding a new BRAS to the List 
    
    ****************************************************************
"""
class AddBRASEntrySessionHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print "new connection"

    def on_message(self,data):
        # Expected data format: new_bras_name:new_bras_ip:new_innerVLAN:new_outer_vlan
        print data 
        dataList = data.split(":")
        new_bras_name = dataList[0]
        new_bras_ip = dataList[1]
        new_inner_vlan = dataList[2]
        new_outer_vlan = dataList[3]

        try: 
            writer = csv.writer(open('/var/e2emonitoring/E2EWebServer/static/OntarioBRASList.csv', 'a'))
            writer.writerow([new_bras_name,new_bras_ip,new_outer_vlan,new_inner_vlan])
        except csv.Error, e:
            self.write_message("Error: "+e.args[0])

        self.write_message("Successfully Added to BRAS List")

    def close(self):
        print 'connection closed'
        self.close()

""" ****************************************************************
    
    Class for Loading The Main 'index.html' Page 
    
    ****************************************************************
"""
class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("index.html", pppoeInfo = "") # send blank pppoeInfo data

""" ****************************************************************
    
    Class for Loading The 'config.html' Page 
    
    ****************************************************************
"""
class ConfigHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("config.html", pppoeInfo = "") # send blank pppoeInfo data

class Application(tornado.web.Application):
    def __init__(self):
    	"""
	initializer for application object
	"""
    	handlers = [
	    (r"/testing", MainHandler),
            (r"/config", ConfigHandler),
            (r"/PPPoEInstr", PPPoESessionHandler),
            (r"/support", AdminSessionHandler),
            (r"/auth/login/", AdminSessionHandler),
            (r"/Tester", TesterSessionHandler),
            (r"/changeBRASEntry", ChangeBRASEntrySessionHandler),
            (r"/addBRASEntry", AddBRASEntrySessionHandler),
            (r"/speedTest", SpeedTestHandler),
            (r"/query7750", Query7750SessionHandler),
	]

	settings = {
	    "debug": True,
            "static_path": os.path.join(os.path.dirname(__file__), "static"),
	}
     
	tornado.web.Application.__init__(self,handlers,**settings)

def main():
    tornado.options.parse_command_line()
    http_server = tornado.httpserver.HTTPServer(Application())
    http_server.listen(options.port) # This is for the final version
    #http_server.listen(options.port,"172.20.135.51")
    tornado.ioloop.IOLoop.instance().start()

if __name__ == "__main__":
    main()
