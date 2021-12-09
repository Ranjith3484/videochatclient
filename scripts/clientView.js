function startCallSession() {
  //webrtc starts here
  "use strict";

  const MESSAGE_TYPE = {
    SDP: "SDP",
    CANDIDATE: "CANDIDATE",
  };

  const MAXIMUM_MESSAGE_SIZE = 65535;
  const END_OF_FILE_MESSAGE = "EOF";
  let code = 123456789;
  let peerConnection;
  let signaling;
  const senders = [];

  const startChat = async () => {
    try {
      var canvas = document.getElementById("render3DModel");
      let userMediaStream = canvas.captureStream(30);
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
        })
        .then((audioStream) => {
          audioStream.getAudioTracks().forEach((track) => {
            userMediaStream.addTrack(track);
          });
          console.log("canv source: ", userMediaStream.getAudioTracks()); // prints  []
        });

      signaling = new WebSocket("wss://videochat-app-bj.herokuapp.com");

      setTimeout(function () {
        peerConnection = createPeerConnection();
        addMessageHandler();
        var canvas = document.getElementById("render3DModel");
        let userMediaStream = canvas.captureStream(30);
        navigator.mediaDevices
          .getUserMedia({
            audio: true,
          })
          .then((audioStream) => {
            audioStream.getAudioTracks().forEach((track) => {
              userMediaStream.addTrack(track);
            });
            userMediaStream
              .getTracks()
              .forEach((track) =>
                senders.push(peerConnection.addTrack(track, userMediaStream))
              );
            document

              .getElementById("myMic")

              .addEventListener("click", function () {
                audioChange(userMediaStream);
              });
          });
      }, 10000);
    } catch (err) {
      console.error(err);
    }
  };

  startChat();

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onnegotiationneeded = async () => {
      await createAndSendOffer();
    };

    pc.onicecandidate = (iceEvent) => {
      if (iceEvent && iceEvent.candidate) {
        sendMessage({
          message_type: MESSAGE_TYPE.CANDIDATE,
          content: iceEvent.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const video = document.getElementById("customerVideoElement");
      video.srcObject = event.streams[0];
      console.log("live streaming-->");
    };

    pc.ondatachannel = (event) => {
      const { channel } = event;
      channel.binaryType = "arraybuffer";

      const receivedBuffers = [];
      channel.onmessage = async (event) => {
        const { data } = event;
        try {
          if (data !== END_OF_FILE_MESSAGE) {
            receivedBuffers.push(data);
          } else {
            const arrayBuffer = receivedBuffers.reduce((acc, arrayBuffer) => {
              const tmp = new Uint8Array(
                acc.byteLength + arrayBuffer.byteLength
              );
              tmp.set(new Uint8Array(acc), 0);
              tmp.set(new Uint8Array(arrayBuffer), acc.byteLength);
              return tmp;
            }, new Uint8Array());
            const blob = new Blob([arrayBuffer]);
            downloadFile(blob, channel.label);
            channel.close();
          }
        } catch (err) {
          console.log("File transfer failed");
        }
      };
    };

    return pc;
  };

  const addMessageHandler = () => {
    signaling.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      console.log(data, "-->");
      if (!data) {
        return;
      }
      const { message_type, content } = data;
      try {
        if (message_type === MESSAGE_TYPE.CANDIDATE && content) {
          await peerConnection.addIceCandidate(content);
        } else if (message_type === MESSAGE_TYPE.SDP) {
          if (content.type === "offer") {
            await peerConnection.setRemoteDescription(content);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            sendMessage({
              message_type: MESSAGE_TYPE.SDP,
              content: answer,
            });
          } else if (content.type === "answer") {
            await peerConnection.setRemoteDescription(content);
          } else {
            console.log("Unsupported SDP type.");
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
  };

  const sendMessage = (message) => {
    signaling.send(
      JSON.stringify({
        ...message,
        code,
      })
    );
  };

  const createAndSendOffer = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendMessage({
      message_type: MESSAGE_TYPE.SDP,
      content: offer,
    });
  };

  //webrtc ends here
}

function endCall() {
  window.location.replace("./index.html");
  const mediaStream = clientVideo.srcObject;
  const mediaTracks = mediaStream.getTracks();
  //stop all tracks
  mediaTracks.forEach((track) => track.stop());
}

function audioChange(userMediaStream) {
  const mediaTracks = userMediaStream.getTracks();
  if (document.getElementById("myMic").classList.contains("active")) {
    //mutemic ui
    document.getElementById("myMic").classList.add("inactive");
    document.getElementById("myMic").classList.remove("active");
    //remove audio track
    mediaTracks.forEach(function (device) {
      if (device.kind === "audio") {
        device.enabled = false; //
        device.muted = true;
      }
    });
  } else {
    //unmutemic ui
    document.getElementById("myMic").classList.add("active");
    document.getElementById("myMic").classList.remove("inactive");
    //add audio track
    mediaTracks.forEach(function (device) {
      if (device.kind === "audio") {
        device.enabled = true;
        device.muted = false;
      }
    });
  }
}

function openCloseNav() {
  if (document.getElementById("mySidenav").classList.contains("hideElement")) {
    document.getElementById("mySidenav").classList.remove("hideElement");
  } else {
    document.getElementById("mySidenav").classList.add("hideElement");
  }
}

function openCloseFeatures() {
  if (
    document
      .getElementById("myFeaturesHolder")
      .classList.contains("hideElement")
  ) {
    //showing features container
    document.getElementById("myFeaturesHolder").classList.remove("hideElement");
    //open camera feature tab by default
    document.getElementById("cameraFeatures").click();
  } else {
    //hiding features container
    document.getElementById("myFeaturesHolder").classList.add("hideElement");
    // document.getElementById("drawLine").style.pointerEvents = "none";
  }
}

function openSideBarAndTab(event, tabName) {
  //hide side features container if it is showing
  if (
    !document
      .getElementById("myFeaturesHolder")
      .classList.contains("hideElement")
  ) {
    document.getElementById("myFeaturesHolder").classList.add("hideElement");
  }
  //showing side nav
  document.getElementById("mySidenav").classList.remove("hideElement");
  openTab(event, tabName);
}

function openTab(evt, tabName) {
  var i, tabContent, tablinks;
  tabContent = document.getElementsByClassName("tabContent");
  for (i = 0; i < tabContent.length; i++) {
    tabContent[i].style.display = "none";
  }

  tablinks = document.getElementsByClassName("tabLinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(
      " activeBorderBlue",
      ""
    );
  }

  tabText = document.getElementsByClassName("iconText");
  for (i = 0; i < tabText.length; i++) {
    tabText[i].className = tabText[i].className.replace(" activeTabText", "");
  }

  document.getElementById(tabName).style.display = "block";

  //removing styles for tab
  if (tabName === "people") {
    document
      .getElementById("chatTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("chatTabIcon").style.color = "";
    document.getElementById("chatTabText").style.color = "";
    document
      .getElementById("appsTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("appsTabIcon").style.color = "";
    document.getElementById("appsTabText").style.color = "";
    document
      .getElementById("settingsTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("settingsTabIcon").style.color = "";
    document.getElementById("settingsTabText").style.color = "";
  } else if (tabName === "chat") {
    document
      .getElementById("peopleTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("peopleTabIcon").style.color = "";
    document.getElementById("peopleTabText").style.color = "";
    document
      .getElementById("appsTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("appsTabIcon").style.color = "";
    document.getElementById("appsTabText").style.color = "";
    document
      .getElementById("settingsTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("settingsTabIcon").style.color = "";
    document.getElementById("settingsTabText").style.color = "";
  } else if (tabName === "apps") {
    document
      .getElementById("peopleTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("peopleTabIcon").style.color = "";
    document.getElementById("peopleTabText").style.color = "";
    document
      .getElementById("chatTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("chatTabIcon").style.color = "";
    document.getElementById("chatTabText").style.color = "";
    document
      .getElementById("settingsTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("settingsTabIcon").style.color = "";
    document.getElementById("settingsTabText").style.color = "";
  } else {
    document
      .getElementById("peopleTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("peopleTabIcon").style.color = "";
    document.getElementById("peopleTabText").style.color = "";
    document
      .getElementById("appsTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("appsTabIcon").style.color = "";
    document.getElementById("appsTabText").style.color = "";
    document
      .getElementById("chatTabLink")
      .classList.replace("activeTabLinks", "tabLinks");
    document.getElementById("chatTabIcon").style.color = "";
    document.getElementById("chatTabText").style.color = "";
  }

  //adding styles for active tab
  if (tabName === "people") {
    document
      .getElementById("peopleTabLink")
      .classList.replace("tabLinks", "activeTabLinks");
    document.getElementById("peopleTabIcon").style.color = "#3399ff";
    document.getElementById("peopleTabText").style.color = "#3399ff";
  } else if (tabName === "chat") {
    document
      .getElementById("chatTabLink")
      .classList.replace("tabLinks", "activeTabLinks");
    document.getElementById("chatTabIcon").style.color = "#3399ff";
    document.getElementById("chatTabText").style.color = "#3399ff";
  } else if (tabName === "apps") {
    document
      .getElementById("appsTabLink")
      .classList.replace("tabLinks", "activeTabLinks");
    document.getElementById("appsTabIcon").style.color = "#3399ff";
    document.getElementById("appsTabText").style.color = "#3399ff";
  } else {
    document
      .getElementById("settingsTabLink")
      .classList.replace("tabLinks", "activeTabLinks");
    document.getElementById("settingsTabIcon").style.color = "#3399ff";
    document.getElementById("settingsTabText").style.color = "#3399ff";
  }
}

//caller devices accessories tab
function openAnotherTab(evt, tabName) {
  var i, tabContent, tablinks;
  tabContent = document.getElementsByClassName("textTabContent");
  for (i = 0; i < tabContent.length; i++) {
    tabContent[i].style.display = "none";
  }

  tablinks = document.getElementsByClassName("textTab");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" activeBold", "");
    console.log(tablinks[i].className);
  }

  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " activeBold";
}

//by default open caller details tab
document.getElementById("defaultOpenAnotherTab").click();

var devicesBrands = [
  {
    brand: "Apple",
    devices: [
      {
        name: "iPhone 13 Pro",
        displayName: "Apple iPhone 13 Pro",
        variant: [
          {
            color: "#a8c6e0",
            image: "./assets/iPhone13Pro/iPhone13Pro_blue.jpeg",
            model: "./assets/iPhone13Pro/iPhone13Pro_blue.glb",
            webLink: "https://www.apple.com/in/iphone/",
            qrLink: "./assets/iPhone13Pro/qr.png",
            active: true,
          },
        ],
      },
      {
        name: "iPhone 12 Pro",
        displayName: "Apple iPhone 12 Pro",
        variant: [
          {
            color: "#F6E0C9",
            image: "./assets/iPhone12Pro/iphone-12-pro-gold.png",
            model: "./assets/iPhone12Pro/iPhone12Pro_Gold.glb",
            webLink: "https://www.apple.com/in/iphone/",
            qrLink: "./assets/iPhone12Pro/qr.png",
            active: true,
          },
          {
            color: "#383428",
            image: "./assets/iPhone12Pro/iphone-12-pro-graphite.png",
            model: "./assets/iPhone12Pro/iPhone12Pro_Graphite.glb",
            webLink: "https://www.apple.com/in/iphone/",
            qrLink: "./assets/iPhone12Pro/qr.png",
          },
          {
            color: "#D8D7CB",
            image: "./assets/iPhone12Pro/iphone-12-pro-silver.png",
            model: "./assets/iPhone12Pro/iPhone12Pro_Silver.glb",
            webLink: "https://www.apple.com/in/iphone/",
            qrLink: "./assets/iPhone12Pro/qr.png",
          },
        ],
      },
    ],
  },
  {
    brand: "Samsung",
    devices: [
      {
        name: "Galaxy A42",
        displayName: "Samsung Galaxy A42",
        variant: [
          {
            color: "black",
            image: "./assets/samsungA42/samsung-a42-black.png",
            model: "./assets/samsungA42/SamsungA42_Black.glb",
            webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
            qrLink: "./assets/SamsungA42/qr.png",
            active: true,
          },
          {
            color: "grey",
            image: "./assets/samsungA42/samsung-a42-gray.png",
            webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
            model: "./assets/samsungA42/SamsungA42_Gray.glb",
            qrLink: "./assets/SamsungA42/qr.png",
          },
          {
            color: "white",
            image: "./assets/samsungA42/samsung-a42-white.png",
            webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
            model: "./assets/samsungA42/SamsungA42_White.glb",
            qrLink: "./assets/SamsungA42/qr.png",
          },
        ],
      },
      {
        name: "Galaxy Z Flip",
        displayName: "Samsung Galaxy Z Flip",
        variant: [
          {
            color: "black",
            image: "./assets/samsungZFlip/black.jpeg",
            model: "./assets/samsungZFlip/SamsungZFlip_Black.glb",
            webLink: "https://www.samsung.com/in/smartphones/galaxy-z-flip/",
            qrLink: "./assets/samsungZFlip/qr.png",
            active: true,
          },
          {
            color: "#cc6633",
            image: "./assets/samsungZFlip/bronze.jpeg",
            webLink: "https://www.samsung.com/in/smartphones/galaxy-z-flip/",
            model: "./assets/samsungZFlip/SamsungZFlip_Bronze.glb",
            qrLink: "./assets/samsungZFlip/qr.png",
          },
          {
            color: "grey",
            image: "./assets/samsungZFlip/grey.jpeg",
            webLink: "https://www.samsung.com/in/smartphones/galaxy-z-flip/",
            model: "./assets/samsungZFlip/SamsungZFlip_MysticGrey.glb",
            qrLink: "./assets/samsungZFlip/qr.png",
          },
          {
            color: "purple",
            image: "./assets/samsungZFlip/purple.jpeg",
            webLink: "https://www.samsung.com/in/smartphones/galaxy-z-flip/",
            model: "./assets/samsungZFlip/SamsungZFlip_Purple.glb",
            qrLink: "./assets/samsungZFlip/qr.png",
          },
        ],
      },
      {
        name: "Galaxy S21",
        displayName: "Samsung Galaxy S21",
        variant: [
          {
            color: "pink",
            image: "./assets/samsungS21/samsung-S21-pink.png",
            model: "./assets/samsungS21/SamsungS21_Pink.glb",
            webLink:
              "https://www.samsung.com/in/smartphones/galaxy-s21-5g/buy/",
            qrLink: "./assets/samsungS21/qr.png",
            active: true,
          },
          {
            color: "violet",
            image: "./assets/samsungS21/samsung-S21-violet.png",
            webLink:
              "https://www.samsung.com/in/smartphones/galaxy-s21-5g/buy/",
            model: "./assets/samsungS21/SamsungS21_Violet.glb",
            qrLink: "./assets/samsungS21/qr.png",
          },
          {
            color: "white",
            image: "./assets/samsungS21/samsung-S21-white.png",
            webLink:
              "https://www.samsung.com/in/smartphones/galaxy-s21-5g/buy/",
            model: "./assets/samsungS21/SamsungS21_White.glb",
            qrLink: "./assets/samsungS21/qr.png",
          },
        ],
      },
    ],
  },
  {
    brand: "Google",
    devices: [
      {
        name: "Pixel 6 Pro",
        displayName: "Google Pixel 6 Pro",
        variant: [
          {
            color: "#343539",
            image: "./assets/pixel6Pro/pixel6_pro_black.jpeg",
            model: "./assets/pixel6Pro/pixel6_pro_black.glb",
            webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
            qrLink: "./assets/pixel6Pro/qr.png",
            active: true,
          },
        ],
      },
    ],
  },
];

//hide devices and show brands
function showBrands() {
  document.getElementById("deviceList").style.display = "none";
  document.getElementById("brandList").style.display = "block";
  document.getElementById("deviceShowCase").style.display = "none";
  localStorage.removeItem("showingDevice");
}

//listing brands
var brandList = "<div>";
for (let i of devicesBrands) {
  brandList += `<ul onclick="showDevices('${i.brand}')" id="${i.brand}">${i.brand} <i class="fa fa-chevron-right iconL"></i></ul>`;
}
brandList += "</div>";
document.getElementById("brandList").innerHTML = brandList;

//hide brand and show devices
function showDevices(item) {
  var arr = devicesBrands;

  arr = arr.filter(function (elem) {
    return elem.brand == item;
  });

  //listing devices;
  var devices = arr[0].devices;
  var deviceList = '<div style="display:flex;width:100%;">';
  deviceList +=
    '<i class="fa fa-chevron-left iconL" onclick="showBrands()" style="margin-top:30px;margin-right:10px;cursor:pointer"></i><span style="display:flex;flex-direction:column;width:100%">';
  for (let i of devices) {
    deviceList += `<ul onclick="showDeviceImage('${
      i.name
    }')" style="margin-bottom:0px;width:100%"><h6 class="deviceNames" id="${
      i.name
    }"  style="border-bottom:${
      i.name == localStorage.getItem("showingDevice") ? "4px solid red" : ""
    }">${i.name}</h6></ul>`;
  }
  deviceList += "</span></div>";

  document.getElementById("deviceList").innerHTML = deviceList;

  localStorage.setItem("showingBrand", arr[0].brand);
  localStorage.setItem("showingDeviceList", JSON.stringify(arr[0].devices));

  document.getElementById("deviceList").style.display = "block";
  document.getElementById("brandList").style.display = "none";
}

//show device show case area
function showDeviceImage(item) {
  var arr = JSON.parse(localStorage.getItem("showingDeviceList"));
  arr = arr.filter(function (elem) {
    return elem.name == item;
  });
  localStorage.setItem("showingDevice", arr[0].name);
  localStorage.setItem("showingDeviceDisplayName", arr[0].displayName);
  localStorage.setItem("showingDeviceImage", arr[0].variant[0].image);
  localStorage.setItem("showingDeviceVariant", arr[0].variant[0].color);
  localStorage.setItem("showingDeviceWebLink", arr[0].variant[0].webLink);
  localStorage.setItem("showingDeviceModel", arr[0].variant[0].model);
  localStorage.setItem("showingDeviceQRLink", arr[0].variant[0].qrLink);
  document.getElementById("deviceShowCase").style.display = "block";
  document.getElementsByClassName("sideFeaturesContainer")[0].style.display =
    "block";

  //add border to active device
  var elements = document.getElementsByClassName("deviceNames");
  for (let i of elements) {
    if (i.innerHTML === arr[0].name) {
      document.getElementById(i.innerHTML).style.borderBottom = "4px solid red";
    } else {
      document.getElementById(i.innerHTML).style.borderBottom = "0px solid red";
    }
  }

  //adding html content for showing device image and by default show first variant
  var showCase = "<div>";
  showCase +=
    "<img src='" +
    localStorage.getItem("showingDeviceImage") +
    " ' class='viewDeviceImage' id='showingDeviceImage' />";
  showCase += "<h6 class='center'>" + arr[0].displayName + "</h6>";
  showCase += " <div class='phoneColorSelector'>";
  //list color variant
  var variant = arr[0].variant;
  var variantList =
    '<div style="display:flex;width:100%;justify-content:space-evenly">';

  for (let i of variant) {
    if (i.color == "white") {
      variantList +=
        "<div style='height:15px;width:15px;border-radius:15px;cursor:pointer;background-color:white;border:1px solid grey' onclick='changeVariant(`" +
        JSON.stringify(i) +
        "`)' id=" +
        i.color +
        " class='colorVariant inactive'></div>";
    } else if (i.active) {
      // mark first variant as selected active
      variantList +=
        "<div style='height:15px;width:15px;border-radius:15px;cursor:pointer;background-color:" +
        i.color +
        " ;box-shadow: 0px 0px 0px 2px white, 0px 0px 0px 3px " +
        i.color +
        ";' onclick='changeVariant(`" +
        JSON.stringify(i) +
        "`)' id=" +
        i.color +
        " class='colorVariant active'></div>";
    } else {
      variantList +=
        "<div style='height:15px;width:15px;border-radius:15px;cursor:pointer;background-color:" +
        i.color +
        "' onclick='changeVariant(`" +
        JSON.stringify(i) +
        "`)' id=" +
        i.color +
        " class='colorVariant inactive'></div>";
    }
  }
  variantList += "</div>";
  //end of variant listing
  showCase += variantList;
  showCase += "</div>";
  showCase +=
    "<button class='outlinedButton' onclick='shareDevice()'>Share</button>";
  showCase += "</div>";
  document.getElementById("deviceShowCase").innerHTML = showCase;
  //show 3d model of first variant by default
  showModel({
    path: arr[0].variant[0].model,
    showQR: false,
  });
}

function changeVariant(item) {
  var details = JSON.parse(item);
  document.getElementById("showingDeviceImage").src = details.image;
  localStorage.setItem("showingDeviceImage", details.image);
  localStorage.setItem("showingDeviceVariant", details.color);
  localStorage.setItem("showingDeviceWebLink", details.webLink);
  localStorage.setItem("showingDeviceModel", details.model);
  localStorage.setItem("showingDeviceQRLink", details.qrLink);

  var i, tablinks;
  tablinks = document.getElementsByClassName("colorVariant");
  for (i of tablinks) {
    if (i.id === details.color) {
      //add active style
      if (i.id === "white") {
        i.style.boxShadow = "0px 0px 0px 2px white, 0px 0px 0px 3px grey";
        i.style.backgroundColor = "#E8E8E8";
        i.style.border = "0px";
      } else {
        i.style.boxShadow = " 0px 0px 0px 2px white, 0px 0px 0px 3px " + i.id;
      }
    } else {
      //add inactive style
      if (i.id === "white") {
        i.style.boxShadow = "0px 0px 0px 0px white";
        i.style.backgroundColor = "white";
        i.style.border = "1px solid grey";
      } else {
        i.style.boxShadow = "0px 0px 0px 0px white";
      }
    }
  }

  //show 3d model of selected variant
  showModel({
    path: details.model,
    showQR: false,
  });
}

function shareDevice() {
  openCloseNav();
  showModel({
    path: localStorage.getItem("showingDeviceQRLink"),
    showQR: true,
  });
}

//clearing local storage item
if (performance.navigation.type == performance.navigation.TYPE_RELOAD) {
  localStorage.removeItem("showingDevice");
}

//show features tab
function openFeatureTab(evt, tabName) {
  var i, tabContent, tablinks;
  tabContent = document.getElementsByClassName("featuresContent");
  for (i = 0; i < tabContent.length; i++) {
    tabContent[i].style.display = "none";
  }

  tablinks = document.getElementsByClassName("featureTabIcon");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" activeFeature", "");
    console.log(tablinks[i].className);
  }

  document.getElementById(tabName).style.display = "flex";
  evt.currentTarget.className += " activeFeature";

  //changing the height of feature holder
  if (tabName === "camera") {
    document.getElementById("myFeaturesHolder").style.height = "40%";
    // document.getElementById("drawLine").style.pointerEvents = "none";
  } else {
    document.getElementById("myFeaturesHolder").style.height = "26%";
    // document.getElementById("drawLine").style.pointerEvents = "all";
  }
}

//show device feature
function showDeviceFeature(feature) {
  var i, tab;
  //removing active style
  tab = document.getElementsByClassName("featuresText");
  for (i = 0; i < tab.length; i++) {
    tab[i].style.fontSize = "28px";
    tab[i].style.fontWeight = "normal";
    tab[i].style.borderBottom = "2px solid #bfbfbf";
  }
  //add active style
  document.getElementById("show" + feature).style.fontSize = "29px !important";
  document.getElementById("show" + feature).style.fontWeight =
    "bolder !important";
  document.getElementById("show" + feature).style.borderBottom =
    "2px solid white";
  localStorage.setItem("showDeviceFeature", feature);
}

//draw line
var canvas,
  ctx,
  flag = false,
  prevX = 0,
  currX = 0,
  prevY = 0,
  currY = 0,
  dot_flag = false;

var x = "white",
  //line width
  y = 6.25;

function init() {
  // canvas = document.getElementById("drawLine");
  // canvas.setAttribute("width", window.innerWidth / 1.2);
  // ctx = canvas.getContext("2d");
  // w = canvas.width;
  // h = canvas.height;
  // canvas.addEventListener(
  //   "mousemove",
  //   function (e) {
  //     findxy("move", e);
  //   },
  //   false
  // );
  // canvas.addEventListener(
  //   "mousedown",
  //   function (e) {
  //     findxy("down", e);
  //   },
  //   false
  // );
  // canvas.addEventListener(
  //   "mouseup",
  //   function (e) {
  //     findxy("up", e);
  //   },
  //   false
  // );
  // canvas.addEventListener(
  //   "mouseout",
  //   function (e) {
  //     findxy("out", e);
  //   },
  //   false
  // );
}

//change annotate color
function changeAnnotateColor(item) {
  var i, tab;
  //removing active style
  tab = document.getElementsByClassName("annotateCircle");
  for (i = 0; i < tab.length; i++) {
    tab[i].style.border = "none";
  }
  //add active style
  document.getElementById("annotate" + item).style.border = "1px solid white";
  localStorage.setItem("annotateColor", item);
  color(item);
}

function color(obj) {
  switch (obj) {
    case "red":
      x = "red";
      break;
    case "black":
      x = "black";
      break;
    case "white":
      x = "white";
      break;
  }
}

function changeWidth() {
  y = document.getElementById("myRange").value / 8;
}

function draw() {
  ctx.beginPath();
  ctx.moveTo(prevX, prevY);
  ctx.lineTo(currX, currY);
  ctx.strokeStyle = x;
  ctx.lineWidth = y;
  ctx.stroke();
  ctx.closePath();
  ctx.lineCap = "round";

  setTimeout(function () {
    ctx.clearRect(0, 0, w, h);
    document.getElementById("canvasimg").style.display = "none";
  }, 5000);
}

function findxy(res, e) {
  if (res == "down") {
    prevX = currX;
    prevY = currY;
    currX = e.clientX - canvas.offsetLeft;
    currY = e.clientY - canvas.offsetTop;

    flag = true;
    dot_flag = true;
    if (dot_flag) {
      ctx.beginPath();
      ctx.fillStyle = x;
      ctx.fillRect(currX, currY, 2, 2);
      ctx.closePath();
      dot_flag = false;
    }
  }
  if (res == "up" || res == "out") {
    flag = false;
  }
  if (res == "move") {
    if (flag) {
      prevX = currX;
      prevY = currY;
      currX = e.clientX - canvas.offsetLeft;
      currY = e.clientY - canvas.offsetTop;
      draw();
    }
  }
}

showModel({
  path: "",
  showQR: false,
});

function showModel(item) {
  var path = item.path;
  var showQR = item.showQR;
  const expandable = item.path.search("ZFlip");
  //show 3d model
  const modelCanvas = document.getElementById("render3DModel"); // Get the canvas element
  modelCanvas.setAttribute("width", window.innerWidth);

  const engine = new BABYLON.Engine(modelCanvas, true); // Generate the BABYLON 3D engine

  // Add your code here matching the playground format

  const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    //change background color
    scene.clearColor = new BABYLON.Color3(0, 1, 0);
    // Parameters: name, alpha, beta, radius, target position, scene
    var camera = new BABYLON.FreeCamera(
      "Camera",
      new BABYLON.Vector3(0, 1, -15),
      scene
    );
    // Add lights to the scene
    var light1 = new BABYLON.HemisphericLight(
      "light1",
      new BABYLON.Vector3(1, 1, 0),
      scene
    );
    light1.intensity = 2;

    // This attaches the camera to the canvas
    camera.attachControl(modelCanvas, false);
    if (path && !showQR) {
      // show 3d model as top layer
      BABYLON.SceneLoader.Append("./", path, scene, function (scene) {
         scene.createDefaultCameraOrLight(true, true, true);
         scene.activeCamera.alpha = Math.PI / 2;
         //change raduis for expandable and non expandable phone
         if(expandable !== -1){
          scene.activeCamera.radius = 0.5;
         }else{
          scene.activeCamera.radius = 7;
         }
        const videoLayer = new BABYLON.Layer("videoLayer", null, scene, true);
        const videoTexture = BABYLON.VideoTexture.CreateFromWebCam(
          scene,
          (videoTexture) => {
            videoTexture._invertY = false;
            videoTexture;
            videoLayer.texture = videoTexture;
          },
          {
            minWidth: 1200,
            minHeight: 1200,
            maxWidth: 1920,
            maxHeight: 1080,
            deviceId: "",
          }
        );
        videoTexture.video.muted = true;
      });
    } else {
      const videoLayer = new BABYLON.Layer("videoLayer", null, scene, true);
      const videoTexture = BABYLON.VideoTexture.CreateFromWebCam(
        scene,
        (videoTexture) => {
          videoTexture._invertY = false;
          videoTexture;
          videoLayer.texture = videoTexture;
        },
        {
          minWidth: 640,
          minHeight: 480,
          maxWidth: 1920,
          maxHeight: 1080,
          deviceId: "",
        }
      );
      // show qr code as top layer
      if (path && showQR) {
        var plane = BABYLON.MeshBuilder.CreatePlane(
          "plane",
          { height: 4, width: 4, sideOrientation: BABYLON.Mesh.SINGLESIDE },
          scene
        );
        var mat = new BABYLON.StandardMaterial("", scene);
        mat.diffuseTexture = new BABYLON.Texture(path, scene);
        plane.material = mat;

        plane.scaling.z = 0.01;
        plane.position.z = 10;
        plane.position.y = 0;
        plane.position.x = -3;

        plane.parent = camera;
        camera.minZ = 0;

        //move the 3d model away from qr to avoid overlay of 3d model over qr
        document.getElementById("showSimInsert").click();
      } else {
        // show only video
        const videoLayer = new BABYLON.Layer("videoLayer", null, scene, true);
        const videoTexture = BABYLON.VideoTexture.CreateFromWebCam(
          scene,
          (videoTexture) => {
            videoTexture._invertY = false;
            videoTexture;
            videoLayer.texture = videoTexture;
          },
          {
            minWidth: 640,
            minHeight: 480,
            maxWidth: 1920,
            maxHeight: 1080,
            deviceId: "",
          }
        );
      }
    }
    // scene.clearColor = new BABYLON.Color4(0, 0, 0, 0.0000000000000001);
    scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);
scene.autoClear = true

    return scene;
  };

  const scene = createScene();

  engine.stopRenderLoop();
  // Register a render loop to repeatedly render the scene
  engine.runRenderLoop(function () {
    scene.render();
  });

  // Watch for browser/canvas resize events
  window.addEventListener("resize", function () {
    engine.resize();
  });

  // Watch for front camera click events
  document
    .getElementById("showFrontCamera")
    .addEventListener("click", function () {
      var cam = scene.activeCamera;
      cam.alpha = 1.429;
      cam.beta = 1.63;
      if(expandable !== -1){
        scene.activeCamera.radius = 0.5;
       }else{
        scene.activeCamera.radius = 7;
       }
    });

  // Watch for back camera click events
  document
    .getElementById("showBackCamera")
    .addEventListener("click", function () {
      var cam = scene.activeCamera;
      cam.alpha = -1.57;
      cam.beta = 1.57; 
      if(expandable !== -1){
        scene.activeCamera.radius = 0.5;
       }else{
        scene.activeCamera.radius = 7;
       }
    });

  // Watch for sim insert click events
  document
    .getElementById("showSimInsert")
    .addEventListener("click", function () {
      var cam = scene.activeCamera;
      cam.alpha = 0.09;
      cam.beta = 1.57;
      if(expandable !== -1){
        scene.activeCamera.radius = 0.5;
       }else{
        scene.activeCamera.radius = 7;
       }
    });

  // Watch for charging port click events
  document
    .getElementById("showChargingPort")
    .addEventListener("click", function () {
      var cam = scene.activeCamera;
      cam.alpha = -1.5;
      cam.beta = 3.13; 
      if(expandable !== -1){
        scene.activeCamera.radius = 0.5;
       }else{
        scene.activeCamera.radius = 7;
       }
    });
}

startCallSession();
