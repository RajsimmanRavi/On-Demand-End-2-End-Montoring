$(document).ready(function() {
  $('#getPPPoESessionsTable').DataTable();
  $('#getPPPoEUsersTable').DataTable();
  $('#getPPPoESessionsInMemTable').DataTable();
} );

function deletePPPoE(pppoeData){
  /* RR: This function is used to perform a couple of tasks: 
          --> Delete PPPoE Sessions or/and Users info on In-Memory Database (sqlite)
          (or)
          --> Stop any background PPPoE sessions and delete the ifcfg-scripts 

  */
  var pppoeSessionInstr = pppoeData.split(":")[0];

  if (pppoeSessionInstr == "all"){
    var pppoeSession = pppoeData.split(":")[1];
    var pppoeStatus = pppoeData.split(":")[2];

    var instr = "delete:all:";
    var dataToSend = instr.concat(pppoeSession); 

  } else if (pppoeSessionInstr == "user"){
    var pppoeUserId = pppoeData.split(":")[1];

    var instr = "delete:user:";
    var dataToSend = instr.concat(pppoeUserId); 
  } else {
    var pppoeUserId = pppoeData.split(":")[1];
    var pppoeSession = pppoeData.split(":")[2];

    var instr = "delete:session:";
    var dataToSend = instr.concat(pppoeUserId+":"); 
    dataToSend = dataToSend.concat(pppoeSession);
  }

  var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/PPPoEInstr"); //new websocket connection 
  ws.onopen = function() {
    console.log(dataToSend);
    ws.send(dataToSend);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page
    location.reload();
  };
}
