import fs from "fs";
import fetch from "node-fetch";
import { config } from "./config.mjs"

const url=`https://api.telegram.org/bot${config.token}/`;
const chatMe=178926524; // to be erased
var lastOffset=0;

var users= {};
// mapping ids to an object
var problems= {};
// mapping id of problems to their text
var tags= {};
/*
const goAdmin={
    key : (s)=> s === config.adminPassword,
    func : async (msg)=>{
        let usr=users[msg.from.id];
        usr.state = "nowAdmin";
        await sendMessage("شما ادمین شدید!", msg.from.id);
    }
};
export const states={
    start : [
        goAdmin,
        {
            key : (s)=> true,
            func : async (msg)=>{
                let usr=users[msg.from.id];
                usr.state = "askProblem";
                await sendMessage(`سلام ${msg.from.first_name}\nجه کمکی از دست من بر می آد؟`, msg.from.id, { keyboard : [["سوال بده!"]] } );
            }
        }         
    ],
    askProblem : [
        goAdmin,
        {
            key : (s)=> s === "سوال بده!",
            func : async (msg)=>{
                let usr=users[msg.from.id];
                usr.state = "givenProblem";
                for(let id in problems){
                    if(usr.solved[id] === undefined){
                        usr.solved[id]=0;
                        sendMessage(problems[id], msg.from.id, {keyboard : [["حلش کردم!"]]});
                        return;
                    }
                }
                await sendMessage('آقا شما همه سوالا رو زدی که!', msg.from.id);
                usr.state = "askProblem";
            }            
        }
    ],
    givenProblem : [
        goAdmin,
        {
            key : (s)=> s === "حلش کردم!",
            func : async (msg)=>{
                let usr=users[msg.from.id];
                usr.state = "askProblem";
                await sendMessage("آورین آورین", msg.from.id, {keyboard : [["سوال بده!"]]} );
            }
        }
    ],
    nowAdmin : [
        {
            key : (s)=> s === "addProblem",
            func : async (msg)=>{
                let usr=users[msg.from.id];
                usr.state = "addProblem";
                await sendMessage("سوال را وارد کنید:", msg.from.id);
            }
        },
        {
            key : (s)=> s === "restart",
            func : async (msg)=>{
                let usr=users[msg.from.id];
                usr.state = "askProblem";
                await sendMessage("همه چیز ریست شد!",msg.from.id,{keyboard : [["سوال بده!"]]});
            }
        }
    ],
    addProblem : [
        {
            key : (s) => true,
            func : async (msg)=>{
                let usr=users[msg.from.id];
                usr.state = "nowAdmin";
                problems[lastProblemId]=msg.text;
                lastProblemId++;
                await sendMessage("سوال شما اضافه شد", msg.from.id);
            }
        }
    ]
};*/

const build= (text,new_state)=>{
    return async (msg)=>{
        let usr= users[msg.from.id];
        usr.state= new_state;
        await sendMessage(text,msg.from.id, states[new_state].keyboard);
    }
};
const keyboards = {
    preStart:             ()=>[["برو بریم"]],
    start:                ()=>[["سوال بده","سوال بگیر"]],
    nameOrTag:            ()=>[["انتخاب تگ","انتخاب اسم"]],
    chooseName:           ()=>undefined,
    chooseTag:            ()=>undefined,
    chooseDif:            ()=>[["آسون","متوسط","سخت"]],
    givenProblem:         ()=>[["هینت بده","حلش رو بگو","حلش کردم!"]],
    checkPass:            ()=>undefined,
    nowAdmin:             ()=>[["سوال جدید","پاک کردن سوال","اطلاعات کاربران"]],
    addName:              ()=>undefined,
    addTag:               ()=>keyboardTag,        
    addDif:               ()=>[["آسون","متوسط","سخت"]],
    addSSH:               ()=>undefined,
    removeName:           ()=>undefined,
    removeTag:            ()=>undefined
};

const states = {
    preStart:[
        {
            key : (s)=>true,
            func: async (msg)=>{
                let usr= users[msg.from.id];
                usr.state= "start";
                await sendMessage(`سلام ${msg.from.first_name}\nچه کمکی از دست من بر می آد`, msg.from.id , keyboards[usr.state] );
            }
        }
    ],
    start:[
        {
            key : (s)=> s==="سوال بده",
            func: async (msg)=>{
                let usr= users[msg.from.id];
                usr.state= "nameOrTag";
                await sendMessage("سوال رو با توجه به تگ انتخاب می کنی یا با اسم؟", msg.from.id , keyboards[usr.state]);
            }
        },
        {
            key : (s)=> s==="سوال بگیر",
            func: async (msg)=>{
                let usr= users[msg.from.id];
                usr.state="checkPass";
                await sendMessage("رمز ادمین را وارد کنید:", msg.from.id, keyboards[usr.state] );
            }
        }        
    ],
    nameOrTag:[
        {
            key : (s)=> s==="انتخاب اسم",
            func: async (msg)=>{
                let usr= users[msg.from.id];
                usr.state="chooseName";
                await sendMessage("اسم سوال را وارد کنید:", msg.from.id, keyboards[usr.state] );
            }
        },
        {
            key : (s)=> s==="انتخاب تگ",
            func: async (msg)=>{
                let usr= users[msg.from.id];
                usr.state="chooseTag";
                await sendMessage("تگ های مورد نظر را در یک خط و پشت سر هم بنویسید و تنها با - از هم جدا کنید.در صورتیکه تنها یک تگ مورد نظر است از - استفاده نکنید!\nمثال:\nاستقرا-اکسترمال-لانه کبوتری");
                let str="لیست تگ های موجود:\n";
                for(let x in tags){
                    str=str + `${x}\n`;
                }
                str=str + `هر تگی\n`;
                await sendMessage(str, msg.from.id, keyboards[usr.state] );
            }
        }
    ],
    chooseName:[
        {
            key : (s)=> s===true,
            func: async (msg)=>{
                let usr= users[msg.from.id];
                let txt=msg.text;
                if(problems[txt] === undefined){
                    usr.state="chooseName";
                    await sendMessage("اسم سوال اشتباه است!\nدوباره بگو", msg.from.id, keyboard[usr.state]);
                }
                else{                    
                    usr.state="givenProblem";
                    usr.solved[txt]= true;
                    await sendMessage(`اسم سوال: ${txt}\n${problem[txt].text}`, msg.from.id, keyboard[usr.state]);
                }
            }
        }
    ],
    chooseTag:[
        {
            key : (s)=>{
                s=s.split('-');
                for(let x of s){
                    if(x === "هر تگی")
                        return true;
                    if(tags[x] === undefined) 
                        return false;
                }
                return true;
            },
            func: async (msg)=>{
                let usr= users[msg.from.id];                
                let s= msg.text;
                usr.lstTag=s;
                usr.state="chooseDif";
                await sendMessage("سختی سوال را انتخاب کنید:", msg.from.id, keyboard[usr.state] );
            }
        }
    ],
    chooseDif:[
        {
            key : (s)=> (s === "آسون" || s === "متوسط" || s === "سخت"),
            func: async (msg)=>{
                let usr= users[msg.from.id];
                let s=usr.lstTag.split('-');
                let anyTag=false;
                for(let x of s){
                    if(x === "هر تگی")
                        anyTag=true;
                }
                let checker= (id)=>{
                    if(usr.solved[id] === true) return false;
                    if(anyTag) return true;
                    for(let x in s){
                        if(problems[id].tag[x] === undefined) return false;
                    }
                    return true;
                }
                for(let prob in problems){
                    if(checker(prob) && prob.dif === msg.text){
                        usr.lstGiven=prob;
                        usr.state="givenProblem";
                        await sendMessage(`اسم سوال: ${prob}\n${problem[prob].text}`, msg.from.id, keyboard[usr.state]);
                        return;
                    }
                }
                usr.state= "nameOrTag";
                await sendMessage("همه سوال هایی که همه این تگ ها رو دارن زدی!\nمی تونی از اول سوال انتخاب کنی.", msg.from.id, keyboard[usr.state] );
            }
        }
    ],
    givenProblem:[
        {
            key : (s)=> s==="هینت بده",
            func: async (msg)=>{
                let usr= users[msg.from.id];
                usr.state= "givenProblem";
                await sendMessage(problems[ usr.lstGiven ].hint, msg.from.id , keyboards[usr.state] );
            }
        },
        {
            key : (s)=> s==="حلش رو بگو",
            func: async (msg)=>{
                let usr= users[msg.from.id];
                usr.state= "nameOrTag";
                await sendMessage(problems[ usr.lstGiven ].hint, msg.from.id , keyboards[usr.state] );
                await sendMessage("حیف شد سوزوندی این رو!حالا می تونی دوباره سوال انتخاب کنی.", msg.from.id, keyboards[usr.state] );
            }
        },
        {
            key : (s)=> s==="حلش کردم!",
            func: async (msg)=>{
                let usr= users[msg.from.id];
                usr.state= "nameOrTag";
                await sendMessage(`سلام ${msg.from.first_name}\nچه کمکی از دست من بر می آد`, msg.from.id , keyboards[usr.state] );
            }
        }
    ],
    checkPass:[
        {            
            key : (s)=> s===config.adminPassword,
            func: async(msg)=>{
                let usr= users[msg.from.id];
                usr.state="nowAdmin";
                usr.isAdmin= true;
                await sendMessage("شما ادمین شدید!", msg.from.id, keyboards[usr.state] );
            }
        }
    ],
    nowAdmin:[
        {            
            key : (s)=> s==="سوال جدید",
            func: async(msg)=>{
                let usr= users[msg.from.id];
                usr.state="addName";
                await sendMessage("اسم سوال را وارد کنید.ترجیحا یک کلمه ای و کوتاه باشد.", msg.from.id, keyboards[usr.state] );
            }
        },
        {            
            key : (s)=> s==="پاک کردن سوال",
            func: async(msg)=>{
                let usr= users[msg.from.id];
                usr.state="removeName";
                await sendMessage("اسم سوال را وارد کنید:", msg.from.id, keyboards[usr.state] );
            }
        },
        {            
            key : (s)=> s==="اطلاعات کاربران",
            func: async(msg)=>{
                let usr= users[msg.from.id];
                usr.state="nowAdmin";
                await sendMessage("حالا بعدا این تیکه رو تکمیل میکنیم.", msg.from.id, keyboards[usr.state] );////////////////////
            }
        }
    ],
    addName:[
        {
            key : (s)=> true,
            func: async(msg)=>{
                let usr= users[msg.from.id];
                let txt= msg.text;
                if(problems[txt] === undefined){
                    usr.state="addTag";
                    await sendMessage("تگ های سوال را انتخاب کنید. تگ ها باید در یک خط و پشت سر هم باشند و با - جدا شوند. در صورتیکه تنها یک تگ دارید از - استفاده نکنید.\nمثال:\nاستقرا-اکسترمال-دوگونه شماری")
                }
                else{
                    usr.lstGiven= txt;
                    problems[txt]= newProblem();
                    usr.state="addName";
                    await sendMessage("اسم قبلا استفاده شده است. دوباره انتخاب کنید.", msg.from.id, keyboard[usr.state]);
                }
            }
        }
    ],
    addTag:[
        {
            key : (s)=> true,
            func: async(msg)=>{
                let usr= users[msg.from.id];
                let txt= msg.text;
                usr.state="addDif";
                let s=txt.split('-');
                for(let tg of s){
                    if(tags[tg] === undefined)
                        tags[tg]=0;
                    tags[tg]++;
                    problems[lstGiven].tag[tg]= true;
                }
                await sendMessage("سختی سوال را انتخاب کنید.",  msg.from.id, keyboard[usr.state] );                
            }
        }
    ],
    addDif:[
        {
            key : (s)=> (s === "آسون" || s === "متوسط" || s === "سخت"),
            func: async(msg)=>{
                let usr= users[msg.from.id];
                problems[lstGiven].dif= msg.text;
                usr.state="addSSH";
                await sendMessage("حالا صورت سوال سپس هینت سوال سپس حل سوال را بنویسید که با $ از هم جدا شده اند.همچنین در متن صورت سوال یا حل سوال یا هینت سوال نباید از $ استفاده کنید.\nمثال:\n2+2=?\nهینت:به شدت بدیهی هست فکر کن!\n4");
            }
        }
    ],
    addSSH:[// statement // soloution // hint
        {
            key : (s)=>{
                let pos1=-1, pos2=-1, pos3=-1;
                for(let i=0;i<s.length;i++){
                    if(pos1 === -1) pos1=i;
                    else if(pos2 === -1) pos2=i;
                    else pos3=i;
                }
                return ( pos1!=-1 && pos2!=-1 && pos3==-1 && pos1!=0 && pos1+1!=pos2 && pos2+1!=s.length );
            },
            func: async(msg)=>{
                let usr= users[msg.from.id];
                let txt= msg.text;
                let s=txt.split('$');
                problems[lstGiven].text=s[0];
                problems[lstGiven].hint=s[1];
                problems[lstGiven].soloution=s[2];
                usr.state="nowAdmin";
                await sendMessage("سوال با موفقیت اضافه شد.", msg.from.id, keyboard[usr.state] );
            }
        }
    ],
    removeName:[
        {
            key : (s)=> problems[s] !==undefined,
            func: async(msg)=>{
                let usr= users[msg.from.id];
                usr.state="nowAdmin";
                let txt= msg.text;
                for(let x in problems[txt].tag){
                    tags[x]--;
                    if(tags[x] === 0) tags[x]= undefined;
                }
                problems[txt]= undefined;
                await sendMessage("سوال حذف شد.", msg.from.id, keyboard[usr.state]);
            }
        }
    ]
};

async function sendMessage(text, chat_id, reply_markup ){
    if(reply_markup == null)
        reply_markup={hide_keyboard:false};
    else if(reply_markup === undefined)
        reply_markup={remove_keyboard:true};
    await fetch( `${url}sendMessage`, {
        method : "POST",
        headers : { 'Content-Type': 'application/json' },   
        body : JSON.stringify( { chat_id, text ,reply_markup} )
    });
}
function getUpdates(){
    return fetch(`${url}getUpdates`,{
        headers : { "Content-Type" : "application/json" },
        method : "POST",
        body : JSON.stringify( { offset : lastOffset+1 } )
    }).then(res=>res.json());
}
function newUser(){
    let ans={
        state:"preStart",
        isAdmin:false,
        solved:{},
        lstTag:undefined,
        lstGiven:undefined
    };
    return ans;
}
function newProblem(){
    let ans={
        tag:{},
        dif:undefined,
        text:undefined,
        hint:undefined,
        soloution:undefined
    }
}
async function handleMessage(msg){
    let usr= users[ msg.from.id ];
    for(let nxt of states[ usr.state ]){
        if(nxt.key(msg.text)){
            await nxt.func(msg);
            return;
        }
    }
    await sendMessage("چی شده؟!",msg.from.id);
}
async function search(){    
    let res= await getUpdates();
    res= res.result;
    for(let x of res){
        console.log(x);
        lastOffset= x.update_id;
        if(users[x.message.from.id] === undefined)
            users[x.message.from.id]=newUser(); 
        await handleMessage(x.message);
    }
}
async function main(){
    while(true){
        await search();
    }
}
main();
