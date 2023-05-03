function onSubmit(){
  // validate
  const urlValue = $("#url").val()
  showStatus("Requesting...")

  // ajax
  $.ajax({
    method: "POST",
    url: "./api/request",
    contentType: "application/json",
    data: JSON.stringify({
      url: urlValue
    })
  }).done(requestSuccess).fail(requestFail)
}

function requestSuccess(data){
  console.log("Request Data: ")
  console.log(data)

  // update status shown
  // setup interval to check status
  const uuid = data.id
  checkStatus(uuid)
}

function requestFail(err){
  // show error
  showStatus("Error " + err.responseText)
}

function checkStatus(uuid){
  $.ajax({
    method: "GET",
    url: `./api/${uuid}/status`,
  }).done(data => statusSuccess(uuid, data)).fail(err => statusFail(uuid, err))
}

function statusSuccess(uuid, data){
  // check if status downloaded
  console.log("Status Data: ")
  console.log(data)

  if(data.inprogress){
    console.log("Status: Downloading")
    showStatus("Processing...")

    // set timeout for checking status again
    setTimeout(() => checkStatus(uuid), 1000)
    return
  }

  if(data.downloaded){
    console.log("Status: Downloaded")

    // update ui
    showStatus("Ready")
    showDownloadButton(uuid)
  }
}

function statusFail(uuid, err){
  // error checking status, check again
  console.log("Status Err: ")
  console.log(err)
}

/**
 * on request click
 *    if validation fail
 *      show error
 *      return
 * 
 *    send ajax to server
 * 
 *    if ajax fail
 *      show error
 *      return
 * 
 *    update status shown
 *    setup interval to check status
 * 
 *    if status inprogress
 *      keep showing loading bar
 * 
 *    if status done
 *      show download button
 */

function showStatus(status){
  const $download = $("#download")

  const statusIndicator = document.createElement("div")
  statusIndicator.textContent = "Status: " + status
  $download.html(statusIndicator)
  $download.css("display", "block")
}

function showDownloadButton(uuid){
  const $download = $("#download");

  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", `./api/${uuid}/download`)
  downloadAnchor.setAttribute("download", "")
  downloadAnchor.textContent = "Download"
  $download.append(downloadAnchor)
}

function saveCookie() {
  const name = $("#name").val()
  const value = $("#value").val()

  const d = new Date();
  d.setTime(d.getTime() + (365*24*60*60*1000));
  let expires = "expires="+ d.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}