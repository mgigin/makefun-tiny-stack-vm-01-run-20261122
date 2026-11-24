import*as F from'node:fs'
let I=process.env.MAKEFUN_INPUT_DIR||'/input',O=process.env.MAKEFUN_OUTPUT_DIR||'/output',W=F.writeFileSync,T="#8;(PUinssssssssAAAAAAA<AAA<AAAsAAAsssssssssssss%**%#sssssssssss<-ssssssssssssss((7(",u=x=>x>>>0,B=[(a,b)=>a+b,(a,b)=>a-b,Math.imul,(a,b)=>a/b,(a,b)=>a%b,(a,b)=>u(a)/u(b),(a,b)=>u(a)%u(b),,(a,b)=>a&b,(a,b)=>a|b,(a,b)=>a^b,,(a,b)=>a<<b,(a,b)=>a>>b,(a,b)=>a>>>b,,(a,b)=>a==b,(a,b)=>a<b,(a,b)=>u(a)<u(b)],G=p=>F.existsSync(p)?F.readFileSync(p):[]
let R=(P,N)=>{let n=P.length,S=new Int32Array(576),o=[],sp=0,csp=0,ip=0,pc=0,st=0,op,c,po,nx,a,t,E=x=>[Buffer.from(o),x]
for(;st<1e6;){if(pc>>>0>=n)return E(9)
c=T.charCodeAt(op=P[pc])-35;if(!(c<80))return E(5)
if(pc+c%5>=n)return E(9)
st++;nx=pc+1+c%5;po=c/5&3
if(sp<po||sp-po+(c/20|0)>256)return E(sp<po?2:3)
pc=nx
switch(op){
case 0:case 83:return E(op?S[sp-1]&255:0)
case 1:case 2:S[sp++]=op<2?P.readInt8(nx-1):P.readInt32LE(nx-4);break
case 3:sp--;break
case 4:case 6:S[sp]=S[sp-(op<5?1:2)];sp++;break
case 5:[S[sp-1],S[sp-2]]=[S[sp-2],S[sp-1]];break
case 7:[S[sp-3],S[sp-2],S[sp-1]]=[S[sp-2],S[sp-1],S[sp-3]];break
case 23:case 27:S[sp-1]=op<27?-S[sp-1]:~S[sp-1];break
case 48:case 49:case 50:if(op==48||(op==49)==!S[--sp])pc=nx+P.readInt16LE(nx-2);break
case 51:if(csp>63)return E(7);S[256+csp++]=nx;pc=P[nx-2]|P[nx-1]<<8;break
case 52:if(!csp)return E(8);pc=S[256+--csp];break
case 64:case 65:a=S[sp-1];if(a>>>8)return E(6);op==64?S[sp-1]=S[320+a]:(S[320+a]=S[sp-2],sp-=2);break
case 80:case 81:if(o.length+(t=op==80?Buffer.from(''+S[--sp]):[S[--sp]&255]).length>65536)return E(11);o.push(...t);break
case 82:S[sp++]=N[ip++]??-1;break
default:if(op>18&&op<23&&!S[sp-1])return E(4);sp--;S[sp-1]=B[op-16](S[sp-1],S[sp])
}}return E(10)}
for(let id of F.readdirSync(I)){let d=I+'/'+id+'/',e=O+'/'+id+'/',[b,x]=R(G(d+'program.bin'),G(d+'input.bin'))
F.mkdirSync(e,{recursive:true});W(e+'stdout.bin',b);W(e+'exit.txt',''+x)}
