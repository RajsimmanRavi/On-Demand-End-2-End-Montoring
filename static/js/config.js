/* ************************************************************
  --> Main Javascript file for the On-Demand E2E Web Server Config Page 
  --> Author: Rajsimman Ravichandiran 
  --> Last Updated: Jan 13, 2016

  ************************************************************* */

/* Global Vars */
var labBRASList = []; 
var labBRASDict = [];
var currList = "";


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
        labBRASList.push(data[i][3]); // Loads the Inner VLAN IDs
        labBRASDict.push(data[i]);
      }
      $(function() {
        $("#vlanId").autocomplete({
          source: labBRASList
        });
      });
    
    },
  });


});

/* ****************************************
   Search using the vLAN ID
   ****************************************
*/
function searchUsingVlan(){
  var innerVlan=document.getElementById("vlanId").value;
  for ( i = 0; i < labBRASDict.length; i++){
    if (labBRASDict[i][3] == innerVlan){
      document.getElementById("brasName").value = labBRASDict[i][0];
      document.getElementById("brasIP").value = labBRASDict[i][1];
    }
  }
}

/* ****************************************
   Submit the Entry change
   ****************************************
*/

function submitChange(){
  
  var innerVlan=document.getElementById("vlanId").value;
  var new_name = document.getElementById("brasName").value;
  var new_ip = document.getElementById("brasIP").value;
  data_to_send = innerVlan+":"+new_name+":"+new_ip;
  console.log(data_to_send);
  var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/changeBRASEntry"); //new websocket connection 
  ws.onopen = function() {  
    ws.send(data_to_send);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page

    // check if error or successfull user id
    if ( evt.data.indexOf("Error") > 0){

      // display error message along with the error output
      document.getElementById("error").style.display = "block";
      document.getElementById("error").innerHTML = evt.data;
    } else{ 
      // display error message along with the error output
      document.getElementById("success").style.display = "block";
      document.getElementById("success").innerHTML = evt.data;
    }
  };

  ws.onclose = function(){
    console.log("connection closed");
  }
}

/* ****************************************
   Submit the new Entry 
   ****************************************
*/

function submitAdd(){

  var new_bras_name =document.getElementById("newBrasName").value;
  var new_bras_ip = document.getElementById("newBrasIp").value;
  var new_inner_vlanId = document.getElementById("innerVlanId").value;
  var new_outer_vlanId = document.getElementById("outerVlanId").value;

  data_to_send = new_bras_name+":"+new_bras_ip+":"+new_inner_vlanId+":"+new_outer_vlanId;
  console.log(data_to_send);
  var ws = new WebSocket("wss://tor63vdseppoe01.isp.intranet.bell.ca/addBRASEntry"); //new websocket connection 
  ws.onopen = function() {  
    ws.send(data_to_send);
  };

  ws.onmessage = function (evt) { // when you receive the link from the server, post it on the web page

    // check if error or successfull user id
    if ( evt.data.indexOf("Error") > 0){

      // display error message along with the error output
      document.getElementById("error").style.display = "block";
      document.getElementById("error").innerHTML = evt.data;
    } else{ 
      // display error message along with the error output
      document.getElementById("success").style.display = "block";
      document.getElementById("success").innerHTML = evt.data;
    }
  };

  ws.onclose = function(){
    console.log("connection closed");
  }

}


/* *****************************************
   Function for downloading the Current BRAS List  
   ***************************************** 
*/

function downloadCurrList(){

  var hiddenElement = document.createElement('a');
  var data = labBRASDict;
  var csvContent = "data:text/csv;charset=utf-8,";


  data.forEach(function(infoArray, index){
   dataString = infoArray.join(",");
   csvContent += index < data.length ? dataString+ "\n" : dataString;
  }); 

  hiddenElement.href = encodeURI(csvContent);
  hiddenElement.target = '_blank';
  hiddenElement.download = 'BRASList.csv';
  hiddenElement.click();
}




