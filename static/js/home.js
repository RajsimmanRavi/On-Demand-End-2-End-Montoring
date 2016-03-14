      window.onload = function(){
          if (parseInt($("#numUsedVMs").text())>=0){
          var numUsedVMs = parseInt($("#numUsedVMs").text());
          console.log(numUsedVMs);
          var perc = (numUsedVMs/5)*100;
          $(".progress .progress-bar").css('width', perc + "%");
          document.getElementById('progressBar').innerHTML = perc+"%";
        
      
          // For some reason, the progress bar (on Create VM form) is not updated with correct width. So, I'm updating it manually 
          $("#vCPUInfoBar").css('width', "25%");
          document.getElementById('vCPUInfoBar').innerHTML = "2";

          $("#memoryInfoBar").css('width', "12.5%");
          document.getElementById('memoryInfoBar').innerHTML = "2048 MB";

          $("#hddGBInfoBar").css('width', "75%");
          document.getElementById('hddGBInfoBar').innerHTML = "150 GB";

          // Change progress bar when size selected on the Create VM form
          var dropdown = document.getElementById("vmSize");
          dropdown.onchange = function(event){
            if(dropdown.value=="Medium"){
               $("#vCPUInfoBar").css('width', "50%");
               document.getElementById('vCPUInfoBar').innerHTML = "4";

               $("#memoryInfoBar").css('width', "50%");
               document.getElementById('memoryInfoBar').innerHTML = "8192 MB";

               $("#hddGBInfoBar").css('width', "100%");
               document.getElementById('hddGBInfoBar').innerHTML = "200 GB";
             } else{
                $("#vCPUInfoBar").css('width', "25%");
                 document.getElementById('vCPUInfoBar').innerHTML = "2";

                 $("#memoryInfoBar").css('width', "12.5%");
                 document.getElementById('memoryInfoBar').innerHTML = "2048 MB";

                 $("#hddGBInfoBar").css('width', "75%");
                 document.getElementById('hddGBInfoBar').innerHTML = "150 GB";

             }
          }
        }
          /* Check if user has 5 or more VMs (if yes, don't allow user to create more */
          $( "#createVM" ).click(function() {
            var numUsedVMs = document.getElementById("numUsedVMs").innerHTML;
            if(numUsedVMs == 5){ 
              alert("You reached the maximum limit! Please delete a VM or contact an admin to extend the limit")
              $( ".modal-dialog" ).hide();
              location.replace("http://127.0.0.1:8888/bellmazon/index/");
              }
          });
      }

      

      function my_callback(data){
        alert(data.message);
      }

       function checkPasswordChange(form){
        if(form.newPassword.value != "" && form.newPassword.value == form.newPassword_2.value) {
          return true;
        }
        else{
          alert("You either did not enter the new password or the new passwords do not match. Please try again");
          return false;
        }     
      }

      function checkStatus_callBack(data){

        $( "#logEntriesTextArea" ).append( data.status +"\n");

        if(data.status.indexOf("Task completed with status success") > -1 ){
          $("#doNotCloseAlert").hide(); //remove the 'Do not close this model' alert 
          $('#successMsgFromAjax').removeAttr( "hidden" ); // show the success message 
          document.getElementById('successMsgFromAjax').innerHTML='<span class="glyphicon glyphicon-ok" aria-hidden="true" style="padding-right:5px;"></span>The Virtual Machine has been created Successfully!! The page will automatically refresh in 5 seconds';
          window.setTimeout(function(){location.replace("http://127.0.0.1:8888/bellmazon/index/");},5000);

        } else if (data.status.indexOf("Task progress") > -1){

          var percentCompleted = data.status.split(" ")[2];
          document.getElementById("taskBar").style.width = percentCompleted;
          console.log(document.getElementById("taskBar").style.width);
          check_status(data.serviceReqId);
        } else if(data.status.indexOf("change the status") > -1){

          $("#doNotCloseAlert").hide(); //remove the 'Do not close this model' alert 
          $('#warningMsgFromAjax').removeAttr( "hidden" ); // show the success message 
          document.getElementById('successMsgFromAjax').innerHTML='<span class="glyphicon glyphicon-ok" aria-hidden="true" style="padding-right:5px;"></span>The Virtual Machine has been created Successfully, however the information could not be stored on the database. Please contact the admin with the VM name!';
          /*window.setTimeout(function(){location.reload()},5000); */
        } else if (data.status.indexOf("Failed") > -1){
          
          $("#doNotCloseAlert").hide(); //remove the 'Do not close this model' alert 
          $('#errorMsgFromAjax').removeAttr( "hidden" ); // show the success message 
          document.getElementById('errorMsgFromAjax').innerHTML='<span class="glyphicon glyphicon-remove" aria-hidden="true" style="padding-right:5px;"></span>Failed to create Virtual Machine. Please try again!';
          window.setTimeout(function(){location.replace("http://127.0.0.1:8888/bellmazon/index/");},5000); 
        } else {

          check_status(data.serviceReqId);
        }
      }


      function check_status(dataVal){
        check = Dajaxice.bellmazon.checkStatus(checkStatus_callBack,{'serviceReqId': dataVal});
      }

      function launchInstance_callback(data){
        if(data[0]['id'] == "#errorMsgFromAjax"){
          $('#errorMsgFromAjax').removeAttr( "hidden" );
          document.getElementById('errorMsgFromAjax').innerHTML='<span class="glyphicon glyphicon-remove" aria-hidden="true" style="padding-right:5px;"></span>'+data[0]['val'];
        } else {
          check_status(data[0]['val'][1]); //sending the serviceReqId
        }
        
      }

      function send_form(){
        var vmName = $('#vmName').val();
        var vmSize = $('#vmSize').val();
        var vmImage = $('#vmImage').val();
        var vDC = $('#vDC').val();  
        if(vmName == ""){
          alert("Please enter a name for the virtual machine!")
          return;
        } else{
          $( ".form-horizontal" ).hide();
          $( "#creatingVMProgress" ).fadeIn( 1000); 
          document.getElementById("taskBar").style.width = "30%";
          Dajaxice.bellmazon.launchInstance(launchInstance_callback,{'vmName': vmName, 'vmSize': vmSize, 'vmImage': vmImage, 'vDC': vDC });
        }
      }

      function checkActionStatus_callBack(data){
        console.log("inside checkActionStatus_callBack")
        $( "#actionStatusTextArea" ).append( data.status +"\n");

        if(data.status.indexOf("Completed") > -1){ 
          $('#vmActionSuccessStatus').removeAttr( "hidden" ); // show the success message 
          document.getElementById('vmActionSuccessStatus').innerHTML='<span class="glyphicon glyphicon-ok" aria-hidden="true" style="padding-right:5px;"></span>Successfully Executed VM Action! This page will automatically refresh in 5 seconds!';
          return window.setTimeout(function(){location.replace("http://127.0.0.1:8888/bellmazon/index/");},5000);
        } else{
          return check_actionStatus(data.serviceReqId);
        }
      }


      function check_actionStatus(dataVal){
        console.log("inside check_actionStatus")
        check = Dajaxice.bellmazon.checkActionStatus(checkActionStatus_callBack,{'actionReqId': dataVal});
      }


      function executeVMAction_callback(data){
        console.log("inside executeVMAction_callback")
        if (data.errorMessage){
          console.log("inside errorMessage?")
          $('#vmActionErrorStatus').removeAttr( "hidden" );
          return document.getElementById('vmActionErrorStatus').innerHTML='<span class="glyphicon glyphicon-remove" aria-hidden="true" style="padding-right:5px;"></span>'+data.errorMessage;
        } else{
          console.log("going to call check_actionStatus function")
          return check_actionStatus(data.serviceResult); //sending the serviceResult from executeAction API 
        }
        
      }

      function performAction(){
        var vmName = document.getElementById('vmNameResourceAction').innerHTML;
        var action = document.getElementById('resourceVMAction').innerHTML;
        var status = document.getElementById('currVMStatus').innerHTML;

        if (status == "ON (poweredOn)" && action == "destroyVM"){
          alert("You cannot delete a Virtual Machine when it's powered on! Please Power off the VM and try again!!");
          location.replace("http://127.0.0.1:8888/bellmazon/index/");
        } else {
          $( "#resourceBody" ).hide();
          $( "#actionProgress" ).fadeIn( 1000); 
          return Dajaxice.bellmazon.executeVMAction(executeVMAction_callback,{'vm_name': vmName, 'action': action});          

        }
      }

      function showResourceAction(status, vm_name, action){
        document.getElementById('vmNameResourceAction').innerHTML = vm_name;
        document.getElementById('resourceVMAction').innerHTML = action;
        document.getElementById('currVMStatus').innerHTML = status;
      }

/*
      function deleteVM(status, vm_name, action){
          if(status == "ON (poweredOn)"){
            alert("You cannot delete a VM when Powered ON! Please Turn off the VM and try deleting it.");
          } else{
            Dajaxice.bellmazon.executeVMAction(executeVMAction,{'vm_name': vm_name, 'action': action});
          }
      }
      */