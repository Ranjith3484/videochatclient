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
      console.log("live streaming--->");
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

    pc.onconnectionstatechange = function (event) {
      switch (pc.connectionState) {
        case "connected":
          document.getElementsByClassName(
            "remoteAudioUnMutedIcon"
          )[0].style.display = "block";
          break;
        case "disconnected":
        case "failed":
          endCall();
          break;
        case "closed":
          endCall();
          break;
      }
    };

    return pc;
  };

  const addMessageHandler = () => {
    signaling.onmessage = async (message) => {
      const data = JSON.parse(message.data);
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
//scale drone api for passing information
const CLIENT_ID = "LT31hadz55oFVVvT";

const drone = new ScaleDrone(CLIENT_ID, {
  data: {
    name: "CSR",
  },
});

let members = [];

drone.on("open", (error) => {
  if (error) {
    return console.error(error);
  }
  console.log("Successfully connected to Scaledrone");

  const room = drone.subscribe("observable-room");
  room.on("open", (error) => {
    if (error) {
      return console.error(error);
    }
    console.log("Successfully joined room");
  });

  room.on("data", (text, member) => {
    if (member.clientData.name === "customer") {
      //check message only from customer
      if (text === "videoViewChange") {
        //check for video change
        if (
          document.getElementById("customerVideoElement").style.display ===
          "none"
        ) {
          document.getElementById("customerVideoElement").style.display =
            "block";
          document.getElementById("customerImageElement").style.display =
            "none";
        } else {
          document.getElementById("customerVideoElement").style.display =
            "none";
          document.getElementById("customerImageElement").style.display =
            "block";
        }
      } else if (text === "audioMuted") {
        console.log("muted");
        document.getElementsByClassName(
          "remoteAudioMutedIcon"
        )[0].style.display = "block";
        document.getElementsByClassName(
          "remoteAudioUnMutedIcon"
        )[0].style.display = "none";
      } else if (text === "audioUnMuted") {
        console.log("un muted");
        document.getElementsByClassName(
          "remoteAudioMutedIcon"
        )[0].style.display = "none";
        document.getElementsByClassName(
          "remoteAudioUnMutedIcon"
        )[0].style.display = "block";
      } else {
        //add the customer name
        document.getElementById("customerName").innerHTML = text.name;
        document.getElementById("customerNameInside").innerHTML = text.name;
        document.getElementById("customerContact").innerHTML = text.contact;
        document.getElementById("callReason").innerHTML = text.reason;
      }
    }
  });
});

drone.on("close", (event) => {
  console.log("Connection was closed", event);
});

drone.on("error", (error) => {
  console.error(error);
});

function audioChange(userMediaStream) {
  const mediaTracks = userMediaStream.getTracks();
  if (document.getElementById("myMic").classList.contains("active")) {
    //mutemic ui
    document.getElementById("myMic").classList.add("inactive");
    document.getElementById("myMic").classList.add("crossLine");
    document.getElementById("myMic").classList.remove("active");
    //send message via drone for audio muted
    drone.publish({
      room: "observable-room",
      message: "audioMuted",
    });
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
    document.getElementById("myMic").classList.remove("crossLine");
    //send message via drone for audio un muted
    drone.publish({
      room: "observable-room",
      message: "audioUnMuted",
    });
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
  document.getElementById("render3DModel").focus();
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
  document.getElementById("render3DModel").focus();
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
            color: "#9aafca",
            image: "./assets/iPhone13Pro/iPhone13Pro_Blue.png",
            model: "./assets/iPhone13Pro/iPhone13Pro_blue.glb",
            webLink: "https://www.apple.com/in/iphone/",
            qrLink: "./assets/iPhone13Pro/qr.png",
            active: true,
          },
          {
            color: "#f5e1c8",
            image: "./assets/iPhone13Pro/iPhone13Pro_Gold.png",
            model: "./assets/iPhone13Pro/iPhone13Pro_gold.glb",
            webLink: "https://www.apple.com/in/iphone/",
            qrLink: "./assets/iPhone13Pro/qr.png",
          },
          {
            color: "#4c4a46",
            image: "./assets/iPhone13Pro/iPhone13Pro_Graphite.png",
            model: "./assets/iPhone13Pro/iPhone13Pro_graphite.glb",
            webLink: "https://www.apple.com/in/iphone/",
            qrLink: "./assets/iPhone13Pro/qr.png",
          },
        ],
      },
      // {
      //   name: "iPhone 12 Pro",
      //   displayName: "Apple iPhone 12 Pro",
      //   variant: [
      //     {
      //       color: "#F6E0C9",
      //       image: "./assets/iPhone12Pro/iphone-12-pro-gold.png",
      //       model: "./assets/iPhone12Pro/iPhone12Pro_Gold.glb",
      //       webLink: "https://www.apple.com/in/iphone/",
      //       qrLink: "./assets/iPhone12Pro/qr.png",
      //       active: true,
      //     },
      //     {
      //       color: "#383428",
      //       image: "./assets/iPhone12Pro/iphone-12-pro-graphite.png",
      //       model: "./assets/iPhone12Pro/iPhone12Pro_Graphite.glb",
      //       webLink: "https://www.apple.com/in/iphone/",
      //       qrLink: "./assets/iPhone12Pro/qr.png",
      //     },
      //     {
      //       color: "#D8D7CB",
      //       image: "./assets/iPhone12Pro/iphone-12-pro-silver.png",
      //       model: "./assets/iPhone12Pro/iPhone12Pro_Silver.glb",
      //       webLink: "https://www.apple.com/in/iphone/",
      //       qrLink: "./assets/iPhone12Pro/qr.png",
      //     },
      //   ],
      // },
    ],
  },
  {
    brand: "Samsung",
    devices: [
      // {
      //   name: "Galaxy A42",
      //   displayName: "Samsung Galaxy A42",
      //   variant: [
      //     {
      //       color: "black",
      //       image: "./assets/samsungA42/samsung-a42-black.png",
      //       model: "./assets/samsungA42/SamsungA42_Black.glb",
      //       webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
      //       qrLink: "./assets/samsungA42/qr.png",
      //       active: true,
      //     },
      //     {
      //       color: "grey",
      //       image: "./assets/samsungA42/samsung-a42-gray.png",
      //       webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
      //       model: "./assets/samsungA42/SamsungA42_Gray.glb",
      //       qrLink: "./assets/samsungA42/qr.png",
      //     },
      //     {
      //       color: "white",
      //       image: "./assets/samsungA42/samsung-a42-white.png",
      //       webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
      //       model: "./assets/samsungA42/SamsungA42_White.glb",
      //       qrLink: "./assets/samsungA42/qr.png",
      //     },
      //   ],
      // },
      {
        name: "Galaxy Z Flip3",
        displayName: "Samsung Galaxy Z Flip3",
        variant: [
          {
            color: "black",
            image: "./assets/samsungZFlip3/Zflip3_Black.png",
            model: "./assets/samsungZFlip3/Zflip3_Black_Animated.glb",
            webLink: "https://www.samsung.com/in/smartphones/galaxy-z-flip/",
            qrLink: "./assets/samsungZFlip3/qr.png",
            active: true,
          },
          {
            color: "#f7f4d3",
            image: "./assets/samsungZFlip3/Zflip3_Cream.png",
            model: "./assets/samsungZFlip3/Zflip3_Cream_Animated.glb",
            webLink: "https://www.samsung.com/in/smartphones/galaxy-z-flip/",
            qrLink: "./assets/samsungZFlip3/qr.png"
          },
          {
            color: "#57666a",
            image: "./assets/samsungZFlip3/Zflip3_Green.png",
            model: "./assets/samsungZFlip3/Zflip3_Green_Animated.glb",
            webLink: "https://www.samsung.com/in/smartphones/galaxy-z-flip/",
            qrLink: "./assets/samsungZFlip3/qr.png"
          },
          {
            color: "#c2b1d7",
            image: "./assets/samsungZFlip3/Zflip3_Lavender.png",
            model: "./assets/samsungZFlip3/Zflip3_Lavender_Animated.glb",
            webLink: "https://www.samsung.com/in/smartphones/galaxy-z-flip/",
            qrLink: "./assets/samsungZFlip3/qr.png"
          },
        ],
      },
      // {
      //   name: "Galaxy S21",
      //   displayName: "Samsung Galaxy S21",
      //   variant: [
      //     {
      //       color: "pink",
      //       image: "./assets/samsungS21/samsung-S21-pink.png",
      //       model: "./assets/samsungS21/SamsungS21_Pink.glb",
      //       webLink:
      //         "https://www.samsung.com/in/smartphones/galaxy-s21-5g/buy/",
      //       qrLink: "./assets/samsungS21/qr.png",
      //       active: true,
      //     },
      //     {
      //       color: "violet",
      //       image: "./assets/samsungS21/samsung-S21-violet.png",
      //       webLink:
      //         "https://www.samsung.com/in/smartphones/galaxy-s21-5g/buy/",
      //       model: "./assets/samsungS21/SamsungS21_Violet.glb",
      //       qrLink: "./assets/samsungS21/qr.png",
      //     },
      //     {
      //       color: "white",
      //       image: "./assets/samsungS21/samsung-S21-white.png",
      //       webLink:
      //         "https://www.samsung.com/in/smartphones/galaxy-s21-5g/buy/",
      //       model: "./assets/samsungS21/SamsungS21_White.glb",
      //       qrLink: "./assets/samsungS21/qr.png",
      //     },
      //   ],
      // },
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
            color: "#343538",
            image: "./assets/pixel6Pro/pixel6Pro_StormyBlack.png",
            model: "./assets/pixel6Pro/pixel6Pro_StormyBlack.glb",
            webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
            qrLink: "./assets/pixel6Pro/qr.png",
            active: true,
          },
          {
            color: "#e9e4e0",
            image: "./assets/pixel6Pro/pixel6Pro_CloudyWhite.png",
            model: "./assets/pixel6Pro/pixel6Pro_CloudyWhite.glb",
            webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
            qrLink: "./assets/pixel6Pro/qr.png"
          },
          {
            color: "#fbf2d1",
            image: "./assets/pixel6Pro/pixel6Pro_SortaSunny.png",
            model: "./assets/pixel6Pro/pixel6Pro_SortaSunny.glb",
            webLink: "https://www.samsung.com/us/smartphones/galaxy-a42-5g/",
            qrLink: "./assets/pixel6Pro/qr.png"
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
    }')" style="margin-bottom:0px;width:100%;"><h6 class="deviceNames" id="${
      i.name
    }"  style="border-bottom:${
      i.name == localStorage.getItem("showingDevice") ? "4px solid red" : "4px solid white"
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

  var j, tab;
  //removing active style for features section
  tab = document.getElementsByClassName("featuresText");
  for (j = 0; j < tab.length; j++) {
    tab[j].style.fontSize = "28px";
    tab[j].style.fontWejght = "normal";
    tab[j].style.borderBottom = "2px solid #bfbfbf";
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
    "<button class='outlinedButton' onclick='shareDevice()' id='shareQR' disabled='true'>Share</button>";
  showCase += "</div>";
  document.getElementById("deviceShowCase").innerHTML = showCase;
  document.getElementById("refreshModel").click();
  //show 3d model of first variant by default
  showModel({
    path: arr[0].variant[0].model,
    showQR: false,
    changeVariant: false,
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
  document.getElementsByClassName("sideFeaturesContainer")[0].style.display =
  "block";
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

  document.getElementById("refreshModel").click();
  //show 3d model of selected variant
  showModel({
    path: details.model,
    showQR: false,
    changeVariant: true,
  });
}

function shareDevice() {
  document.getElementById("refreshModel").click();
  // hide features opener while sharing qr code
  document.getElementsByClassName("sideFeaturesContainer")[0].style.display =
  "none";
  showModel({
    path: localStorage.getItem("showingDeviceQRLink"),
    showQR: true,
    changeVariant: false,
  });
  openCloseNav();
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
  document.getElementById("render3DModel").focus();
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

// //change annotate color
// function changeAnnotateColor(item) {
//   var i, tab;
//   //removing active style
//   tab = document.getElementsByClassName("annotateCircle");
//   for (i = 0; i < tab.length; i++) {
//     tab[i].style.border = "none";
//   }
//   //add active style
//   document.getElementById("annotate" + item).style.border = "1px solid white";
//   localStorage.setItem("annotateColor", item);
//   color(item);
// }

// function color(obj) {
//   switch (obj) {
//     case "red":
//       x = "red";
//       break;
//     case "black":
//       x = "black";
//       break;
//     case "white":
//       x = "white";
//       break;
//   }
// }

// function changeWidth() {
//   y = document.getElementById("myRange").value / 8;
// }

// function draw() {
//   ctx.beginPath();
//   ctx.moveTo(prevX, prevY);
//   ctx.lineTo(currX, currY);
//   ctx.strokeStyle = x;
//   ctx.lineWidth = y;
//   ctx.stroke();
//   ctx.closePath();
//   ctx.lineCap = "round";

//   setTimeout(function () {
//     ctx.clearRect(0, 0, w, h);
//     document.getElementById("canvasimg").style.display = "none";
//   }, 5000);
// }

// function findxy(res, e) {
//   if (res == "down") {
//     prevX = currX;
//     prevY = currY;
//     currX = e.clientX - canvas.offsetLeft;
//     currY = e.clientY - canvas.offsetTop;

//     flag = true;
//     dot_flag = true;
//     if (dot_flag) {
//       ctx.beginPath();
//       ctx.fillStyle = x;
//       ctx.fillRect(currX, currY, 2, 2);
//       ctx.closePath();
//       dot_flag = false;
//     }
//   }
//   if (res == "up" || res == "out") {
//     flag = false;
//   }
//   if (res == "move") {
//     if (flag) {
//       prevX = currX;
//       prevY = currY;
//       currX = e.clientX - canvas.offsetLeft;
//       currY = e.clientY - canvas.offsetTop;
//       draw();
//     }
//   }
// }

//initial call to show webcam
showModel({
  path: "",
  showQR: false,
  changeVariant: false,
});

var walkRotation = {
  x: 0,
  y: 0,
};

var walkPosition = {
  x: -2.5,
  y: 0.5,
};

var walkScaling = {
  x: 0.9,
  y: 0.9,
  z: -1,
};

function showModel(item) {
  var path = item.path;
  var showQR = item.showQR;
  var changeVariant = item.changeVariant;
  var shareQRDevice = document.getElementById("shareQR");
  //disable the share device button before model loading
  if (shareQRDevice !== null) {
    shareQRDevice.disabled = true;
    shareQRDevice.style.cursor = "not-allowed";
  }

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

    //keyboard events for moving the model
    scene.onKeyboardObservable.add((kbInfo) => {
      let walk = scene.getMeshByName("__root__");
      switch (kbInfo.type) {
        case BABYLON.KeyboardEventTypes.KEYDOWN:
          switch (kbInfo.event.key) {
            case "a":
            case "ArrowLeft":
              walk.position.x -= 0.1;
              break;
            case "d":
            case "ArrowRight":
              walk.position.x += 0.1;
              break;
            case "w":
            case "ArrowUp":
              walk.position.y += 0.1;
              break;
            case "s":
            case "ArrowDown":
              walk.position.y -= 0.1;
              break;
            case "z":
            case "Z":
              walk.scaling.x += 0.1;
              walk.scaling.y += 0.1;
              walk.scaling.z -= 0.1;
              break;
            case "u":
            case "U":
              walk.scaling.x -= 0.1;
              walk.scaling.y -= 0.1;
              walk.scaling.z += 0.1;
              break;
          }
      }
      walkPosition.x = parseFloat(walk.position.x);
      walkPosition.y = parseFloat(walk.position.y);

      walkScaling.x = parseFloat(walk.scaling.x);
      walkScaling.y = parseFloat(walk.scaling.y);
      walkScaling.z = parseFloat(walk.scaling.z);
    });

    //rotate using mouse
    let currentPosition = { x: 0, y: 0 };
    var currentRotation = { x: 0, y: 0 };

    let clicked = false;

    scene.onPointerObservable.add((pointerInfo) => {
      var walk = scene.getMeshByName("__root__");
      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERDOWN:
          currentPosition.x = pointerInfo.event.clientX;
          currentPosition.y = pointerInfo.event.clientY;
          currentRotation.x = walk.rotation.x;
          currentRotation.y = walk.rotation.y;
          clicked = true;
          break;
        case BABYLON.PointerEventTypes.POINTERUP:
          clicked = false;
          break;
        case BABYLON.PointerEventTypes.POINTERMOVE:
          if (!clicked) {
            return;
          }
          if (walk !== null) {
            walk.rotation.y =
              currentRotation.y -
              (pointerInfo.event.clientX - currentPosition.x) / 100.0;

            walk.rotation.x =
              currentRotation.x +
              (pointerInfo.event.clientY - currentPosition.y) / 100.0;
          }
          break;
        case BABYLON.PointerEventTypes.POINTERWHEEL:
          break;
        case BABYLON.PointerEventTypes.POINTERPICK:
          console.log("POINTER PICK");
          break;
        case BABYLON.PointerEventTypes.POINTERTAP:
          break;
        case BABYLON.PointerEventTypes.POINTERDOUBLETAP:
          break;
      }

      walkPosition.x = parseFloat(walk.position.x);
      walkPosition.y = parseFloat(walk.position.y);

      walkRotation.x = parseFloat(walk.rotation.x);
      walkRotation.y = parseFloat(walk.rotation.y);
    });

    // This attaches the camera to the canvas
    camera.attachControl(modelCanvas, true);
    if (path && !showQR) {
      // show 3d model as top layer
      BABYLON.SceneLoader.Append("./", path, scene, function (scene) {
        scene.createDefaultCameraOrLight(false, true, false);

        var walk = scene.getMeshByName("__root__");

        setTimeout(function () {
          //manual delay to avoid any meshes
          //enable the share device button once model loaded
          shareQRDevice.disabled = false;
          shareQRDevice.style.cursor = "pointer";
        }, 2000);

        //initialize the model position

        walk.position.x = -2.5;
        walk.position.y = 0.2;

        walk.scaling.z = -1;
        walk.scaling.x = 0.9;
        walk.scaling.y = 0.9;

        if (changeVariant && walk !== null) {
          //set to previous position, if variant changed
          walk.rotation.x = parseFloat(walkRotation.x);
          walk.rotation.y = parseFloat(walkRotation.y);
          walk.position.x = parseFloat(walkPosition.x);
          walk.position.y = parseFloat(walkPosition.y);
          walk.scaling.x = parseFloat(walkScaling.x);
          walk.scaling.y = parseFloat(walkScaling.y);
          walk.scaling.z = parseFloat(walkScaling.z);
        } else {
          //set to default values  while changing model
          walkPosition.x = -2.5;
          walkPosition.y = 0.2;
          walkRotation.x = 0;
          walkRotation.y = 0;
          walkScaling.x = 1;
          walkScaling.y = 1;
          walkScaling.z = -1;
        }

        //pushing rotation object to enable camera features
        walk.rotation = new BABYLON.Vector3(walk.rotation.x, walk.rotation.y);

        //pushing position object to enable camera features
        walk.position = new BABYLON.Vector3(walk.position.x, walk.position.y);

        //pushing scaling object to enable camera features
        walk.scaling = new BABYLON.Vector3(
          walk.scaling.x,
          walk.scaling.y,
          walk.scaling.z
        );

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
      // intilization for correctly showing qr --> starts here
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
      if (path && showQR) {
          // add text below qr code
          var textPlane = BABYLON.MeshBuilder.CreatePlane(
            "textPlane",
            { height: 0.5, width: 2, sideOrientation: BABYLON.Mesh.SINGLESIDE },
            scene
          );
          var textureGround = new BABYLON.DynamicTexture(
            "dynamic texture",
            { width: 512, height: 120},
            scene
          );
  
          var textMaterial = new BABYLON.StandardMaterial("Mat", scene);
          textMaterial.diffuseTexture = textureGround;
          textPlane.material = textMaterial;
  
          textPlane.scaling.z = 0.01;
          textPlane.position.z = 10;
          textPlane.position.y = 0;
          textPlane.position.x = -4;
          textPlane.scaling.x = -1;
          textPlane.scaling.y = -1;
  
          textPlane.parent = camera;
          camera.minZ = 0;
  
          //Add text to dynamic texture
          var font = "bold 33px monospace";
          textureGround.drawText(
            "  Scan to explore in AR",
            5,
            100,
            font,
            "black",
            "white",
            true,
            true
          );
          // text ends here
        // add qr code
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
        plane.position.y = 1;
        plane.position.x = -4;
        plane.scaling.x = -1;
        plane.scaling.y = -1;

        plane.parent = camera;
        camera.minZ = 0;

      
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
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0.0000000000000001);
    document.getElementById("render3DModel").focus();
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
      var walk = scene.getMeshByName("__root__");
      walk.rotation.x = 0;
      walk.rotation.y = 0;

      walkRotation.x = 0;
      walkRotation.y = 0;
    });

  // Watch for back camera click events
  document
    .getElementById("showBackCamera")
    .addEventListener("click", function () {
      var walk = scene.getMeshByName("__root__");
      walk.rotation.x = 0.006;
      walk.rotation.y = -3.09;

      walkRotation.x = parseFloat(0.006);
      walkRotation.y = parseFloat(-3.09);
    });

  // Watch for sim insert click events
  document
    .getElementById("showSimInsert")
    .addEventListener("click", function () {
      var walk = scene.getMeshByName("__root__");
      walk.rotation.x = 0.083;
      walk.rotation.y = 4.5;

      walkRotation.x = parseFloat(0.083);
      walkRotation.y = parseFloat(4.5);
    });

  // Watch for charging port click events
  document
    .getElementById("showChargingPort")
    .addEventListener("click", function () {
      var walk = scene.getMeshByName("__root__");
      walk.rotation.x = -1.45;
      walk.rotation.y = 2.66;

      walkRotation.x = parseFloat(-1.45);
      walkRotation.y = parseFloat(2.66);
    });

  // Watch for model change and dispose the model
  document
    .getElementById("refreshModel")
    .addEventListener("click", function () {
      //dispose sceneloader
      var walk = scene.getMeshByName("__root__");
      if (walk !== null) {
        walk.dispose();
      }

      //dispose plane
      var plane = scene.getMeshByName("plane");
      if (plane !== null) {
        plane.dispose();
      }
    });
}

startCallSession();
