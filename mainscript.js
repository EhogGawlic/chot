let cchat = null;
console.log(document);
console.log(document.getElementById);
console.log(Object.getPrototypeOf(document));

const chaotbar = document.getElementById("chatsbar");
async function createChat(name,users){
    const res = await fetch('/create',{
        credentials:"include",
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },body:JSON.stringify({cname:name,users})
    })
    if (res.ok){
        alert("Created!")
        window.location.reload()
    }
}
async function getUnread(chatid){
    
    const res = await fetch('/chats/unread',{
        credentials:"include",
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    })
    if (res.ok){
        const jsonres = await res.json()
        return jsonres
    }
}
async function getUsername() {
    const res = await fetch('/username', {
        method:"GET",
        credentials: "include"
    })
    if (res.ok){
        const result = await res.text()
        if (result == "Not logged in"){
            return ""
        } else {
            return result
        }
    }
}
(async()=>{

    const res = await fetch('chats', {
        credentials:"include",
        method: "POST"
    })
    const chats = await res.json()
    const ur = await getUnread()
    chats.forEach((chat,i) => {
        const name = chat.cName
        chaotbar.innerHTML += `
            <button class="chatbtn" id="cbtn${i}" onclick='
        cchat = ${chat.cId};
                (async()=>{const mres = await fetch("messages", {
        credentials:"include",
        method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
        body: JSON.stringify({chat: ${chat.cId}})
    })
        if (mres.ok){

            const result = await mres.json()
            mainbox.innerText = ""
            result.forEach(msg=>{
                mainbox.innerText += "By "+msg.Username+": "+ msg.content+"\\n"    
            })
            document.querySelector("#cbtn${i} div").innerText="0"
    }
    })()
            '>${name.substr(0,2)}<div class="notify">${ur[i].unread}</div></button>
        `
    });
})()

async function fmsgs(chatid){
    if (cchat || chatid){
        const mres = await fetch("messages", {
            credentials:"include",
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({chat: cchat})
        })
        if (mres.ok){
            const result = await mres.json()
            mainbox.innerText = ""
            result.forEach(msg=>{
                mainbox.innerText += "By "+msg.Username+": "+ msg.content+"\n"    
            })
            mainbox.scrollTop=mainbox.scrollHeight
        }
    }
}
async function getUnread(chatid){
    
    const res = await fetch('/chats/unread',{
        credentials:"include",
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    })
    if (res.ok){
        const jsonres = await res.json()
        return jsonres
    }
}
setInterval(fmsgs,1000)
let cusers = []
async function onloaded(){
    const gei = function(id){return document.getElementById(id)}
gei("ncbtn").addEventListener("click", ()=>{
    gei("ccbox").style.display = "block"
})
const tuser = await getUsername()
const ccui = gei("ccusersinp")
const ccaub = gei("ccaubtn")
const ccul = gei("ccusersli")
const cname = gei("cnameinp")
if (tuser){
    cusers.push(tuser)
} else {
    gei("ncbtn").remove()
}
ccaub.addEventListener("click",async()=>{
    const user = ccui.value
    const check = await fetch('/checkuser/'+user, {
        method: "GET"
    })
    if (check.ok & !cusers.includes(user)){
        cusers.push(user)
        ccul.innerHTML += `
            <li>${user} <button onclick="
                cusers.splice(cusers.indexOf(${user}),1)
                this.parentNode.remove()
            ">Remove</button></li>
        `
    } else {
        alert("User not found")
    }
})
gei("cccbtn").onclick=()=>{
    createChat(cname.value,cusers)
}
}
onload=()=>{
    setTimeout(onloaded,100)
}