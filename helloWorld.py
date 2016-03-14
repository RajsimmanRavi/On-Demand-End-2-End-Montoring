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

con = sqlite3.connect(":memory:")
cur = con.cursor()
cur.execute("CREATE TABLE currUsers(user TEXT, [timestamp] timestamp);");
cur.execute("CREATE TABLE pppoeSessions (user TEXT, pppoeSession TEXT);")

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
        userData = [] # gets userid's and timestamp from the In-memory database
        pppoeSessionsData = [] # gets pppoeInfo from the In-memory database

        username = self.get_argument("username", "")
        password = self.get_argument("password", "")
        auth = self.check_permission(password, username)
        if auth:
            currPPPoESessions = self.getCurrPPPoESessions()

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

            pppoeUsersData = self.getInMemDBData('currUsers')
            pppoeSessionsData =  self.getInMemDBData('pppoeSessions')

            self.render("admin.html", pppoeInfo = data, pppoeUsersInfo = pppoeUsersData, pppoeSessionsInfo = pppoeSessionsData)
        else:
            error_msg = u"?error=" + tornado.escape.url_escape("Login incorrect")
            self.redirect(u"/auth/login/" + error_msg)

    def getCurrPPPoESessions(self):
        
        with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
            fout.write('')
            p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./currPPPoESessions.sh"], stdout=fout, stderr=fout).communicate()[0]
        
        read_log = subprocess.Popen(["cat", "/var/e2emonitoring/shellScripts/currpppLog"], stdout=subprocess.PIPE).communicate()[0]
        
        return read_log
        

    def getInMemDBData(self, tableName):
        data = []
        cur.execute("Select * from "+tableName+";")
        currData = cur.fetchall()
        for info in list(currData):
            pppoeUsersInfo = { 'pppoeUserId': str(info[0]), 
                'info': str(info[1])
            }
            data.append(pppoeUsersInfo)
        print data
        return data

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("index.html", pppoeInfo = "") # send blank pppoeInfo data


class TesterSessionHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        print "open: new Tester Sesion"

    def on_message(self,data):

        instr = data.split(":")[0] # could be for new session or closing the session (i.e. instr could be 'new' or 'close')   
        if instr == "new":
            userSession = str("%0.6d" % random.randint(0,999999))

            """
            RR: Check if a random ID already exists (later: TODO)

            cur.execute("Select * from currUsers where user = ?", (userSession, ))
            checkUserIDExists=cur.fetchone() 
            if checkUsersIDExists is not None:
            
            """

            cur.execute('''INSERT INTO currUsers (user,timestamp) VALUES (?,?) ''',(userSession,datetime.datetime.now()))
            
            print "After inserting the current User, the database now contains: "
            cur.execute("Select * from currUsers;")
            currData = cur.fetchall()

            for info in list(currData):
                print str(info)

            self.write_message(str(userSession))
        else:
            """
                3 Things we need to perform when a user closes the browser
                1. Get the pppoeSessions associated with the user from the PPPoESessions Table of the DB and send \n
                   them to cleanup script to stop and delete those PPPoe Sessions
                2. Remove the user from the Users Table of the DB
                3. Remove those pppoeSessions records from the PPPoESessions table 
            """
            testerSessionToClose = data.split(":")[1] #received from javascript
            
            """No. 1"""
            cur.execute('''Select pppoeSession from pppoeSessions where user = '''+str(testerSessionToClose))
            currSessions = cur.fetchall()
            print "The User has these pppoeSessions currently in the database"
            pppNames = ""
            for info in list(currSessions):
                if pppNames: # names already inserted
                    pppNames=pppNames+","+str(info[0])
                else: #The first name
                    pppNames = str(info[0])
            
            print str(pppNames)

            with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
                fout.write('')
                p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./cleanUpSessions.sh", pppNames], stdout=fout, stderr=fout).communicate()[0]
    
            # No. 2 
            cur.execute('''Delete from currUsers where user = '''+str(testerSessionToClose))
            
            print "After deleting the current User, the database now contains: "
            cur.execute("Select * from currUsers;")
            currData = cur.fetchall()

            for info in list(currData):
                print str(info)

            # No. 3
            cur.execute('''Delete from pppoeSessions where user = '''+str(testerSessionToClose))
            
            print "After deleting the pppoeSessions, the database now contains: "
            cur.execute("Select * from pppoeSessions;")
            currData = cur.fetchall()

            for info in list(currData):
                print str(info)

    def on_close(self):
        self.close()

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

            if defaultUser:
                username="b1test04"
                password="bb123456"

                        
            with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
                fout.write('')
                p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./choosePPPoECreateScript.sh", username, password, vlan_id], stdout=fout, stderr=fout).communicate()[0]

            #read_log= subprocess.Popen(["cat", "/var/e2emonitoring/shellScripts/currpppLog"], stdout=subprocess.PIPE).communicate()[0]
            
            # Gets the newly created pppoeSession, along with the username and ip Address 
            # This info will be used to create a row on the PPPoE Sessions Sumary Table 
            # Also used to create a row in sqlite db to map the current user to the created pppoe Session
            # Format of pppoeSessionName -> <pppoeSession>:<username>:<ipAddr> (ex. ppp2:b1test04:)
            pppoeSessionName = subprocess.Popen(["/var/e2emonitoring/shellScripts/./newCreatedPPPoESession.sh"], stdout=subprocess.PIPE).communicate()[0]
            pppoeSessionName = pppoeSessionName.rstrip() # remove \n from the string
            print "pppoeSessionName is: "+str(pppoeSessionName)

            with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
                fout.write('')
                p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./startSpecificPPPoESession.sh", pppoeSessionName[3]], stdout=fout, stderr=fout).communicate()[0]

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
            """
            # The file currpppLog is for only the current PPPoE session instruction (for output to user)
            with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
                fout.write('')
                p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./testSpecificPPPoESessions.sh", pppoeSession, testOption, domain], stdout=fout, stderr=fout).communicate()[0]

            read_log= subprocess.Popen(["cat", "/var/e2emonitoring/shellScripts/currpppLog"], stdout=subprocess.PIPE).communicate()[0]
            print read_log
            # This one is for logging all the PPPoE Sessions output for debugging purposes
            with open("/var/e2emonitoring/shellScripts/pppLog", 'a') as fout:
                fout.write("---"+str(datetime.datetime.now())+"---")
                fout.write(str(read_log))

            self.write_message(str(read_log))
            """
        else: #delete PPPoE script
            if "all" in numPPPoE:
                pppName = dataList[2]
                print pppName
                 # stop and delete PPPoE session if running
                with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
                    fout.write('')
                    p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./cleanUpSessions.sh", pppName], stdout=fout, stderr=fout).communicate()[0]

                read_log= subprocess.Popen(["cat", "/var/e2emonitoring/shellScripts/currpppLog"], stdout=subprocess.PIPE).communicate()[0]

                self.write_message(str(read_log))
            elif "user" in numPPPoE:
                
                userId = dataList[2]
                
		cur.execute('''Delete from currUsers where user = '''+str(userId))
                
		self.write_message("Deleted Successfully!")
            else:
                print str(dataList)
                userId = dataList[2]
                pppName = dataList[3]

                # stop and delete PPPoE session if running
                with open("/var/e2emonitoring/shellScripts/currpppLog", 'w') as fout:
                    fout.write('')
                    p = subprocess.Popen(["/var/e2emonitoring/shellScripts/./cleanUpSessions.sh", pppName], stdout=fout, stderr=fout).communicate()[0]

                # delete from Database 
                cur.execute('''Delete from pppoeSessions where user = '''+str(userId))

                self.write_message("Deleted Successfully!")

    def on_close(self):
        print 'connection closed'
        self.close()

def main():
    tornado.options.parse_command_line()
    settings = {
	    "debug": True,
	    "static_path": os.path.join(os.path.dirname(__file__), "static"),
    }

    application = tornado.web.Application([
	    (r"/", MainHandler),
        (r"/PPPoEInstr", PPPoESessionHandler),
        (r"/admin", AdminSessionHandler),
         (r"/auth/login/", AdminSessionHandler),
        (r"/Tester", TesterSessionHandler),
        (r"/query7750", Query7750SessionHandler),

    ], **settings)

    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(8080,'172.20.135.51')
    ioloop = tornado.ioloop.IOLoop().instance()
    autoreload.start(ioloop)
    ioloop.start()

if __name__ == "__main__":
    main()
