/* ************************************************************
  --> Main Javascript file for the On-Demand E2E Web Server  
  --> Author: Rajsimman Ravichandiran 
  --> Last Updated: Jan 08, 2016

  ************************************************************* */

/* Global Vars */
var labBRASList = []; 
var labBRASDict = {};
var testOutput = "";


/* When Page loads, execute these functions */
$(document).ready(function() {

  /* Load Tooltip */
  $('[data-toggle="tooltip"]').tooltip(); 

  /* Load the BRAS NAMES from the CSV File */
  $.ajax({
    url: "static/OntarioBRASList.csv",
    async: false,
    success: function (csvd) { 
      data = $.csv.toArrays(csvd);
      for ( i = 0; i < data.length; i++){
        labBRASList.push(data[i][0]);
        labBRASDict[data[i][0]]=data[i][3]; 
      }
      $(function() {
        $("#vlanId").autocomplete({
          source: labBRASList 
        });
      });
    },
  });

  /* Create a Token ID for a new Tester */
  if(window.location.pathname == "/testing"){ 
  
    var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/Tester"); //new websocket connection 
    ws.onopen = function() {  
      var instr = "new";
      ws.send(instr);
    };

    ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page

      // check if error or successfull user id
      if ( evt.data.indexOf("Error") > 0){

        // display error message along with the error output
        document.getElementById("errormessage").style.display = "block";
        document.getElementById("errormessage").innerHTML = evt.data;

      } else{ 
        $("#tester").append("<p>Hi Tester, your Session ID is: # <span id='testerNo'>"+evt.data+"</span></p>");
      }

    };
  }else{
    console.log("admin");
  }

});

/* Highlight special Key Words on the Test Output TextArea */
function highlightText(){

    // Destroy any old highlighted text
    $('textarea').highlightTextarea('destroy');

    $('textarea').highlightTextarea({
      words: [{
        // Regex for IP Addresses
        words: ['(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)[.]){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)','succeeded','ppp[0-9]','Successfully'],
        color: '#CAF1A1'
      },{    
        words: ['not started', 'terminated', 'Terminating', 'Access Denied'],
        color: '#FF8080'
      },{
        words: ['Connected to.*', 'HTTP.*'],
        color: '#ADF0FF'
      },{
        words: ['havent_received_any_such_output_yet'], // WILL UPDATE WHEN HAPPENS
        color: '#FF0000'
      }],
      caseSensitive: false
    });
}

/* Enable/Disable Username & Password Text Input if 'Default User' option checked */
function validate() {
  if (document.getElementById('defaultUser').checked) {
    document.getElementById('username').disabled=true;
    document.getElementById('password').disabled=true;
  } else {
    document.getElementById('username').disabled=false;
    document.getElementById('password').disabled=false;
  }
}

/* *****************************************
   Main function for Creating PPPoE Sessions 
   ***************************************** 
*/
function createPPPoE(){
  var username = $('#username').val();
  var password = $('#password').val();
  var tester_sessionNum = $("#testerNo").html(); //used to map the current Tester session to the newly created pppoe session
  var defaultUser = document.getElementById('defaultUser').checked;
  var vlanName = $('#vlanId').val();
  
  vlan = labBRASDict[vlanName];

  // If BRAS was not selected, alert the Tester
  if(typeof vlan === 'undefined'){
    alert("You can't start a PPPoE Session without choosing a BRAS!");

  }else{

    // Send data in this format: <username>,<password>,<#####>,<{vlan_id}>,<true/false>
    var argInfo = username.concat(","+password+","+tester_sessionNum+","+vlan+","+defaultUser);

    var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/PPPoEInstr"); //new websocket connection 
    ws.onopen = function() {
      
      // First, show Loading Spinner to notify User
      document.getElementById("loadingSpinner").style.display = "inline-block";

      var instr = "create:";
      var dataToSend = instr.concat(argInfo); 
      ws.send(dataToSend);
    };

    ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
      
      // Remove Loading Spinner
      document.getElementById("loadingSpinner").style.display = "none";
      
      // data comes in this format --> <create_pppoe_script_output>*<pppoeSession>*<username> 
      console.log(evt.data);

      // If they want to clean Previous output, then empty the textarea and remove any highlights 
      if($("#outputStyle").val() == "clean"){
        $( "#testOutputTextArea" ).empty();
      }

      // Split the data
      data = evt.data.split("*"); 
      
      // Check if PPPoE Script succeeded
      if (data[0].indexOf("succeeded") > 0){

        startpppInfo = data[0]; // output of create PPPoE script
        $( "#testOutputTextArea" ).append("\n"+startpppInfo +"\n");

        // Call highlight TextArea function 
        highlightText(); 

        sessionName = data[1]; 
        username = data[2];
        console.log(sessionName);
        console.log(username);
        ipAddr = startpppInfo.split("local  IP address ")[1].split(" ")[0].split("\n")[0];

        // Update the PPPoE Sessions table         
        var table = document.getElementById("getPPPoESessionsTable");
        var row = table.insertRow(1);
        row.setAttribute("id", "", 0); //NEED TO CHANGE THAT!
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        var cell3 = row.insertCell(2);
        var cell4 = row.insertCell(3);
        
        cell1.innerHTML = "<button type='submit' class='btn btn-danger' id='all:"+sessionName+"' onclick='deletePPPoE(this.id)'><i class='fa fa-trash'></i> Stop</button>";
        cell2.innerHTML = sessionName;
        cell3.innerHTML = username;
        cell4.innerHTML = ipAddr;
        
        sessionNum = sessionName.match(/\d+/)[0] // "returns # of ppp#"
        // Update the DropDown list on Test Section to include the PPPoE Session name
        $("#testPPPoeSessionNum").append("<option value='"+sessionNum+"'>"+sessionName+"</option>");
       } else {

        // Post the Failed output to the Test Output Text Area
        $( "#testOutputTextArea" ).append("\n"+data[0]+"\n");
        
        // Call highlight TextArea function 
        highlightText(); 

      }
    }
  };
}

/* *****************************************
   Main function for Testing PPPoE Sessions 
   ***************************************** 
*/
function testPPPoE(){  
  var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/PPPoEInstr"); //new websocket connection 
  ws.onopen = function() {

    // First, show Loading Spinner to notify User
    document.getElementById("loadingSpinner").style.display = "inline-block";

    var numSession = $('#testPPPoeSessionNum :selected').val();
  	var testOption = $('input[name=typeCmd]:checked', '#testOptions').val();
  	var domain = $('#domain').val();	 
  	var argInfo = numSession.concat(","+testOption).concat(","+domain);
	
	var instr = "test:";
  	var dataToSend = instr.concat(argInfo); 
    console.log(dataToSend); 
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
  	
    // Hide Loading Spinner
      document.getElementById("loadingSpinner").style.display = "none";

    // Append Data to testOutput Global Variable

    testOutput = testOutput + " " + String(evt.data);
    console.log(evt.data);
    console.log(testOutput);

    // If they want to clean Previous output, then empty the textarea and remove any highlights 
    if($("#outputStyle").val() == "clean"){
      $( "#testOutputTextArea" ).empty();
    }

    $( "#testOutputTextArea" ).append("\n"+evt.data+"\n");
    
    // Call highlight TextArea function 
    highlightText(); 

    
  };
}


/* *****************************************
   Function for doing a Speed Test on a PPPoE Session  
   ***************************************** 
*/

function speedTest(){

  // First, show Loading Spinner to notify User
  document.getElementById("loadingSpinner").style.display = "inline-block";

  /* Get the selected SpeedTest Server*/
  var speedTestServer = $('#speedTestServers :selected').val();
  var sessionNum = $('#testPPPoeSessionNum :selected').val();

  /* Now we need to get the IP address corressponding to the selected PPPoE Session 
     I get this from the IP Address cell on the PPPoE Sessions Summary 
  */
  var ip_addr = $(document.getElementById("all:ppp"+sessionNum).closest("td")).siblings().last().html()
  console.log(ip_addr);
  
  var data_to_send = speedTestServer+":"+ip_addr

  var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/speedTest"); //new websocket connection 
  ws.onopen = function() { 
    console.log(data_to_send); 
    ws.send(data_to_send);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page

    // Hide Loading Spinner 
    document.getElementById("loadingSpinner").style.display = "none";

    // Append Data to testOutput Global Variable
    testOutput = testOutput + " " + String(evt.data);
    console.log(evt.data);
    console.log(testOutput);

    // If they want to clean Previous output, then empty the textarea and remove any highlights 
    if($("#outputStyle").val() == "clean"){
      $( "#testOutputTextArea" ).empty();
    }

    $( "#testOutputTextArea" ).append("\n"+evt.data+"\n");
    
    // Call highlight TextArea function 
    highlightText(); 

  };

  ws.onclose = function(){
    console.log("connection closed");
  }


}


/* *****************************************
   Main function for Deleting PPPoE Sessions 
   ***************************************** 
*/

function deletePPPoE(pppoeData){
  // Since the Admin page also uses this javascript to delete Users from In-Memory DB, we differentiate the functionality by:
  //  --> if pppoeData is 'all' -- means stop and delete PPPoE session
  //  --> if pppoeData is 'user' -- means admin is trying to delete user from the In-memory DB

  var pppoeStatus = pppoeData.split(":")[0]; // whether it's 'all' or 'user'
  var pppoeName = pppoeData.split(":")[1]; //session name ex. 'ppp2' 

  var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/PPPoEInstr"); //new websocket connection 
  ws.onopen = function() {

  // First, show Loading Spinner to notify User
  document.getElementById("loadingSpinner").style.display = "inline-block";

  var instr = "delete:";
  var dataToSend = instr.concat(pppoeStatus+":"+pppoeName); 
        
  ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
      
      // Hide Loading Spinner 
      document.getElementById("loadingSpinner").style.display = "none";

      console.log("event.data: "+evt.data);

      // check if error or successfull user id
      if ( evt.data.indexOf("Error") > 0){

        // display error message along with the error output
        document.getElementById("errormessage").style.display = "block";
        document.getElementById("errormessage").innerHTML = evt.data;

      } else {
        // If choose to Append or clean output 
        if($("#outputStyle").val() == "clean"){
          $( "#testOutputTextArea" ).empty();
         
        }
          
        $( "#testOutputTextArea" ).append("\n"+evt.data +"\n");
          
        console.log("pppoeName: "+pppoeName);
        $('tr > td:contains("'+pppoeName+'")').parent().remove();
        $("#testPPPoeSessionNum option[value='"+pppoeName[3]+"']").remove();

        // Call highlight TextArea function 
        highlightText(); 
        
      } 
      
    }; 
}

/* *****************************************
   Function for downloading the Test Output  
   ***************************************** 
*/

function downloadOutput(){

  var hiddenElement = document.createElement('a');

  console.log(testOutput);
  hiddenElement.href = 'data:attachment/text,' + encodeURI(testOutput);
  hiddenElement.target = '_blank';
  hiddenElement.download = 'testOutput.txt';
  hiddenElement.click();

}



/* *****************************************
   Main function for Deleting All PPPoE Sessions and the tester session when the user closes the browser 
   ***************************************** 
*/
window.onbeforeunload = function() {

 if(window.location.pathname == "/testing"){
  var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/Tester"); //new websocket connection 
  ws.onopen = function() {
    var instr = "close:";
    var tester_sessionNum = $("#testerNo").html();
    var dataToSend = instr.concat(tester_sessionNum);
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
    //alert(evt.data);
  };

  return "ALL YOUR PPPOE SESSIONS HAVE BEEN CLOSED!";
  } else{
    console.log("admin");
  }
};



/* *****************************************
   Function for Querying 7750 (DEPRECATED AND NOT BEING USED) 
   ***************************************** 
*/
function query7750(){
  var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/query7750"); //new websocket connection 
  ws.onopen = function() {
    var dataToSend = "blah" 
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
    $( "#testOutputTextArea" ).empty();
    $( "#testOutputTextArea" ).append( evt.data +"\n");

  };
}


