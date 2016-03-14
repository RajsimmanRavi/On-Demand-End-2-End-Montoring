$(document).ready(function() {
  //$('#getPPPoESessionsTable').DataTable();

  var ws = new WebSocket("ws://172.20.135.51:8080/Tester"); //new websocket connection 
  ws.onopen = function() {  
    var instr = "new";
    ws.send(instr);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
    $("#tester").append("<p>Hi random user, your Session ID is: # <span id='testerNo'>"+evt.data+"</span></p>");
  };

} );

function HighlightTextareaText(nameTextArea,strSearch){

  var strLength = strSearch.length;
  var contents = $(nameTextArea);
  var startPos = contents.val().indexOf(strSearch);
  //var startPos = contents.value;
  //alert(startPos);
  $(nameTextArea).selectionStart = startPos;
  $(nameTextArea).selectionEnd = startPos + strLength;
  $(nameTextArea).focus();
  $(nameTextArea).setSelectionRange(startPos, startPos+strLength);
}

function createPPPoE(){
  var username = $('#username').val();
  var password = $('#password').val();
  var tester_sessionNum = $("#testerNo").html(); //used to map the current Tester session to the newly created pppoe session

  var argInfo = username.concat(","+password+","+tester_sessionNum);
	
  var ws = new WebSocket("ws://172.20.135.51:8080/PPPoEInstr"); //new websocket connection 
  ws.onopen = function() {
    
    var instr = "create:";
    var dataToSend = instr.concat(argInfo); 
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
    // data comes in this format --> <pppoeSession>:<username>:<ipAddr> (ex. ppp2:b1test04:)
    data = evt.data.split(":");
    console.log(data);
    if (data.length > 0){
      $( "#testOutputTextArea" ).empty();
      $( "#testOutputTextArea" ).append("<span style=\"background-color:#00FF00\">Successfully created a PPPoE Session!!</span><br/>");
      $( "#testOutputTextArea" ).append("<span style=\"background-color:#00FF00\">PPPoE Session Name: "+data[0]+"</span><br/>");
      $( "#testOutputTextArea" ).append("<span style=\"background-color:#00FF00\">PPPoE Session User Name: "+data[1]+"</span><br/>");
      $( "#testOutputTextArea" ).append("<span style=\"background-color:#00FF00\">PPPoE Session User Name: "+data[2]+"</span><br/>");

      // RR: update the PPPoE Sessions table without refreshing the page
      data = evt.data.split(":");
      var table = document.getElementById("getPPPoESessionsTable");
      var row = table.insertRow(1);
      var cell1 = row.insertCell(0);
      var cell2 = row.insertCell(1);
      //var cell3 = row.insertCell(2);
      cell1.innerHTML = data[0];
      cell2.innerHTML = data[1];
      //cell3.innerHTML = data[2];

      pppoeSessionNum = data[0].substr(data[0].length - 1);
      $("#startPPPoeSessionNum").append("<option value='"+pppoeSessionNum+"' }}>"+data[0]+"</option>");

    } else {
      $( "#testOutputTextArea" ).empty();
      $( "#testOutputTextArea" ).append("<span style=\"background-color:red\">Create PPPoE Session failed. Data returned was empty.</span>"+"\n");
    }
    
  };
}

function startPPPoE(){
  var ws = new WebSocket("ws://172.20.135.51:8080/PPPoEInstr"); //new websocket connection 
  var numSessionsStart = $('#startPPPoeSessionNum :selected').val()
  ws.onopen = function() {
  	var instr = "start:";
  	var dataToSend = instr.concat(numSessionsStart); 
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
  	$( "#testOutputTextArea" ).empty();
    $( "#testOutputTextArea" ).append( evt.data +"\n");

    $("#testPPPoeSessionNum").append("<option value='"+numSessionsStart+"' }}>ppp"+numSessionsStart+"</option>");
    $("#stopPPPoeSessionNum").append("<option value='"+numSessionsStart+"' }}>ppp"+numSessionsStart+"</option>");

    var x = document.getElementById("startPPPoeSessionNum");
    x.remove(x.selectedIndex);
  };
}

function stopPPPoE(){
  var ws = new WebSocket("ws://172.20.135.51:8080/PPPoEInstr"); //new websocket connection 
  ws.onopen = function() {
  	var numSession = $('#stopPPPoeSessionNum :selected').val()
  	var instr = "stop:";
  	var dataToSend = instr.concat(numSession); 
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
  	$( "#testOutputTextArea" ).empty();
    $( "#testOutputTextArea" ).append( evt.data +"\n");

    var x = document.getElementById("stopPPPoeSessionNum");
    x.remove(x.selectedIndex);

    var x = document.getElementById("testPPPoeSessionNum");
    x.remove(x.selectedIndex);
  };
}
function testPPPoE(){  
  var ws = new WebSocket("ws://172.20.135.51:8080/PPPoEInstr"); //new websocket connection 
  ws.onopen = function() {

    var numSession = $('#testPPPoeSessionNum :selected').val();
  	var testOption = $('input[name=optradio]:checked', '#testOptions').val();
  	var domain = $('#domain').val();	

  	var argInfo = numSession.concat(","+testOption).concat(","+domain);
	
	var instr = "test:";
  	var dataToSend = instr.concat(argInfo); 
    
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
  	$( "#testOutputTextArea" ).empty();
    console.log(evt.data);
    //var pattern = evt.data.search(/HTTP.*/);
    //alert("PAttern: " + pattern);
    var text = evt.data;
    //alert("Text: " + text);
	  var pattern = text.match(/Local Interface.*/m);
    //alert("Pattern: " + pattern);
    var textnew = text.replace(pattern,' <span style="background-color:yellow">' + pattern + '</span> ');
    var pattern2 = text.match(/Connected to.*/m);
    textnew = textnew.replace(pattern2,' <span style="background-color:yellow">' + pattern2 + '</span> ');
    var pattern3 = text.match(/< HTTP.*/i);
    //alert("pAttern 3: " + pattern3);
	  textnew = textnew.replace(pattern3,' <span style="background-color:yellow">' + pattern3 + '</span>');	
    //alert("Evt.data: " +textnew);
    $( "#testOutputTextArea" ).append(textnew+"\n");
    //console.log($("#testOutputTextArea").innerHTML);
    //var text = $('#testOutputTextArea').innerHTML;
	//alert(text);
	//var pattern1 = $('#testOutputTextArea').innerHTML.search(/GET\/HTTP.*<L/);
    //$('#testOutputTextArea').innerHTML.replace(pattern1,'<span style="background-color:yellow">' + pattern1 + "</span>");
	 // alert($("#testOutputTextArea").val());
	 // HighlightTextareaText("#testOutputTextArea", "HTTP");
  };
}


function deletePPPoE(pppoeData){
  var pppoeSession = pppoeData.split(":")[0];
  var pppoeStatus = pppoeData.split(":")[1];

  if(pppoeStatus != "Link-down"){
    alert("You cannot delete a PPPoE when the link is active. Please stop the PPPoE session and try again!");
    location.reload();
 } else{
  //chools.comlse {
    
    var ws = new WebSocket("ws://172.20.135.51:8080/PPPoEInstr"); //new websocket connection 
    ws.onopen = function() {

      var instr = "delete:";
      var dataToSend = instr.concat(pppoeSession); 
        
      ws.send(dataToSend);
    };


    ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
      //$( "#testOutputTextArea" ).empty();
      //$( "#testOutputTextArea" ).append( evt.data +"\n");
      //alert(evt.data);
      location.reload();
    };
    } 
}

window.onbeforeunload = function() {

  var ws = new WebSocket("ws://172.20.135.51:8080/Tester"); //new websocket connection 
  ws.onopen = function() {
    var instr = "close:";
    var tester_sessionNum = $("#testerNo").html();
    var dataToSend = instr.concat(tester_sessionNum);
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
    //alert(evt.data);
  };

  return "Please close this page, as all of your pppoe sessions have been closed and deleted!";
  
};
