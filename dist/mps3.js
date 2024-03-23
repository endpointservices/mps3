async function q(z,$){const J=await crypto.subtle.importKey("raw",typeof z==="string"?v.encode(z):z,{name:"HMAC",hash:{name:"SHA-256"}},!1,["sign"]);return crypto.subtle.sign("HMAC",J,v.encode($))}async function e(z){return crypto.subtle.digest("SHA-256",typeof z==="string"?v.encode(z):z)}var b=function(z){return Array.prototype.map.call(new Uint8Array(z),($)=>("0"+$.toString(16)).slice(-2)).join("")},z0=function(z){return z.replace(/[!'()*]/g,($)=>"%"+$.charCodeAt(0).toString(16).toUpperCase())},O0=function(z,$){const{hostname:J,pathname:X}=z;if(J.endsWith(".r2.cloudflarestorage.com"))return["s3","auto"];if(J.endsWith(".backblazeb2.com")){const W=J.match(/^(?:[^.]+\.)?s3\.([^.]+)\.backblazeb2\.com$/);return W!=null?["s3",W[1]]:["",""]}const Q=J.replace("dualstack.","").match(/([^.]+)\.(?:([^.]*)\.)?amazonaws\.com(?:\.cn)?$/);let[Z,Y]=(Q||["",""]).slice(1,3);if(Y==="us-gov")Y="us-gov-west-1";else if(Y==="s3"||Y==="s3-accelerate")Y="us-east-1",Z="s3";else if(Z==="iot")if(J.startsWith("iot."))Z="execute-api";else if(J.startsWith("data.jobs.iot."))Z="iot-jobs-data";else Z=X==="/mqtt"?"iotdevicegateway":"iotdata";else if(Z==="autoscaling"){const W=($.get("X-Amz-Target")||"").split(".")[0];if(W==="AnyScaleFrontendService")Z="application-autoscaling";else if(W==="AnyScaleScalingPlannerFrontendService")Z="autoscaling-plans"}else if(Y==null&&Z.startsWith("s3-"))Y=Z.slice(3).replace(/^fips-|^external-1/,""),Z="s3";else if(Z.endsWith("-fips"))Z=Z.slice(0,-5);else if(Y&&/-\d$/.test(Z)&&!/-\d$/.test(Y))[Z,Y]=[Y,Z];return[C0[Z]||Z,Y]},v=new TextEncoder,C0={appstream2:"appstream",cloudhsmv2:"cloudhsm",email:"ses",marketplace:"aws-marketplace",mobile:"AWSMobileHubService",pinpoint:"mobiletargeting",queue:"sqs","git-codecommit":"codecommit","mturk-requester-sandbox":"mturk-requester","personalize-runtime":"personalize"},F0=new Set(["authorization","content-type","content-length","user-agent","presigned-expires","expect","x-amzn-trace-id","range","connection"]);class k{constructor({accessKeyId:z,secretAccessKey:$,sessionToken:J,service:X,region:Q,cache:Z,retries:Y,initRetryMs:W}){if(z==null)throw new TypeError("accessKeyId is a required option");if($==null)throw new TypeError("secretAccessKey is a required option");this.accessKeyId=z,this.secretAccessKey=$,this.sessionToken=J,this.service=X,this.region=Q,this.cache=Z||new Map,this.retries=Y!=null?Y:10,this.initRetryMs=W||50}async sign(z,$){if(z instanceof Request){const{method:Q,url:Z,headers:Y,body:W}=z;if($=Object.assign({method:Q,url:Z,headers:Y},$),$.body==null&&Y.has("Content-Type"))$.body=W!=null&&Y.has("X-Amz-Content-Sha256")?W:await z.clone().arrayBuffer();z=Z}const J=new $0(Object.assign({url:z},$,this,$&&$.aws)),X=Object.assign({},$,await J.sign());delete X.aws;try{return new Request(X.url.toString(),X)}catch(Q){if(Q instanceof TypeError)return new Request(X.url.toString(),Object.assign({duplex:"half"},X));throw Q}}async fetch(z,$){for(let J=0;J<=this.retries;J++){const X=fetch(await this.sign(z,$));if(J===this.retries)return X;const Q=await X;if(Q.status<500&&Q.status!==429)return Q;await new Promise((Z)=>setTimeout(Z,Math.random()*this.initRetryMs*Math.pow(2,J)))}throw new Error("An unknown error occurred, ensure retries is not negative")}}class $0{constructor({method:z,url:$,headers:J,body:X,accessKeyId:Q,secretAccessKey:Z,sessionToken:Y,service:W,region:D,cache:U,datetime:P,signQuery:F,appendSessionToken:G,allHeaders:O,singleEncode:I}){if($==null)throw new TypeError("url is a required option");if(Q==null)throw new TypeError("accessKeyId is a required option");if(Z==null)throw new TypeError("secretAccessKey is a required option");this.method=z||(X?"POST":"GET"),this.url=new URL($),this.headers=new Headers(J||{}),this.body=X,this.accessKeyId=Q,this.secretAccessKey=Z,this.sessionToken=Y;let _,o;if(!W||!D)[_,o]=O0(this.url,this.headers);if(this.service=W||_||"",this.region=D||o||"us-east-1",this.cache=U||new Map,this.datetime=P||(new Date()).toISOString().replace(/[:-]|\.\d{3}/g,""),this.signQuery=F,this.appendSessionToken=G||this.service==="iotdevicegateway",this.headers.delete("Host"),this.service==="s3"&&!this.signQuery&&!this.headers.has("X-Amz-Content-Sha256"))this.headers.set("X-Amz-Content-Sha256","UNSIGNED-PAYLOAD");const T=this.signQuery?this.url.searchParams:this.headers;if(T.set("X-Amz-Date",this.datetime),this.sessionToken&&!this.appendSessionToken)T.set("X-Amz-Security-Token",this.sessionToken);if(this.signableHeaders=["host",...this.headers.keys()].filter((H)=>O||!F0.has(H)).sort(),this.signedHeaders=this.signableHeaders.join(";"),this.canonicalHeaders=this.signableHeaders.map((H)=>H+":"+(H==="host"?this.url.host:(this.headers.get(H)||"").replace(/\s+/g," "))).join("\n"),this.credentialString=[this.datetime.slice(0,8),this.region,this.service,"aws4_request"].join("/"),this.signQuery){if(this.service==="s3"&&!T.has("X-Amz-Expires"))T.set("X-Amz-Expires","86400");T.set("X-Amz-Algorithm","AWS4-HMAC-SHA256"),T.set("X-Amz-Credential",this.accessKeyId+"/"+this.credentialString),T.set("X-Amz-SignedHeaders",this.signedHeaders)}if(this.service==="s3")try{this.encodedPath=decodeURIComponent(this.url.pathname.replace(/\+/g," "))}catch(H){this.encodedPath=this.url.pathname}else this.encodedPath=this.url.pathname.replace(/\/+/g,"/");if(!I)this.encodedPath=encodeURIComponent(this.encodedPath).replace(/%2F/g,"/");this.encodedPath=z0(this.encodedPath);const t=new Set;this.encodedSearch=[...this.url.searchParams].filter(([H])=>{if(!H)return!1;if(this.service==="s3"){if(t.has(H))return!1;t.add(H)}return!0}).map((H)=>H.map((K)=>z0(encodeURIComponent(K)))).sort(([H,K],[r,s])=>H<r?-1:H>r?1:K<s?-1:K>s?1:0).map((H)=>H.join("=")).join("&")}async sign(){if(this.signQuery){if(this.url.searchParams.set("X-Amz-Signature",await this.signature()),this.sessionToken&&this.appendSessionToken)this.url.searchParams.set("X-Amz-Security-Token",this.sessionToken)}else this.headers.set("Authorization",await this.authHeader());return{method:this.method,url:this.url,headers:this.headers,body:this.body}}async authHeader(){return["AWS4-HMAC-SHA256 Credential="+this.accessKeyId+"/"+this.credentialString,"SignedHeaders="+this.signedHeaders,"Signature="+await this.signature()].join(", ")}async signature(){const z=this.datetime.slice(0,8),$=[this.secretAccessKey,z,this.region,this.service].join();let J=this.cache.get($);if(!J){const X=await q("AWS4"+this.secretAccessKey,z),Q=await q(X,this.region),Z=await q(Q,this.service);J=await q(Z,"aws4_request"),this.cache.set($,J)}return b(await q(J,await this.stringToSign()))}async stringToSign(){return["AWS4-HMAC-SHA256",this.datetime,this.credentialString,b(await e(await this.canonicalString()))].join("\n")}async canonicalString(){return[this.method.toUpperCase(),this.encodedPath,this.encodedSearch,this.canonicalHeaders+"\n",this.signedHeaders,await this.hexBodyHash()].join("\n")}async hexBodyHash(){let z=this.headers.get("X-Amz-Content-Sha256")||(this.service==="s3"&&this.signQuery?"UNSIGNED-PAYLOAD":null);if(z==null){if(this.body&&typeof this.body!=="string"&&!("byteLength"in this.body))throw new Error("body must be a string, ArrayBuffer or ArrayBufferView, unless you include the X-Amz-Content-Sha256 header");z=b(await e(this.body||""))}return z}}var N=()=>crypto.randomUUID(),J0=(z)=>g(z,10);var C=(z)=>`${z.bucket}/${z.key}`;var V0=(z,$)=>{const J=Math.ceil($/5);return z.toString(32).padStart(J,"0")};var g=(z,$)=>{const J=Math.pow(2,$)-1;return V0(J-z,$)},X0=(z,$)=>{const J=Math.pow(2,$)-1,X=parseInt(z,32);return J-X};var R=(z=0)=>g(z,42);var L=async(z)=>{const $=Date.now();return[await z,Date.now()-$]},p=(z,$)=>{if($.adaptiveClock)return L(z).then(([J,X])=>{if(J.status!==200)return J;const Q=J.headers.get("date");if(Q){let Z=0;const Y=new Date(Q).getTime(),W=Date.now()+$.clockOffset;if(W<Y-X)Z=Y-W-X;else if(W>Y+1000+X)Z=Y+1000-W+X;if(Z>0)$.clockOffset=$.clockOffset+Z;if(Z>0)console.log("latency",X,"error",Z,"local_time",W,"server_time",Y,"config.clockOffset",$.clockOffset)}return J});return z};var Q0=(z,$)=>{const J=$.parseFromString(z,"text/xml");if(!J)throw new Error(`Invalid XML: ${z}`);const X=J.getElementsByTagName("Contents"),Q=(Z,Y)=>{const W=Z.getElementsByTagName(Y)[0]?.textContent;return W?decodeURIComponent(W.replace(/\+/g," ")):void 0};return{$metadata:{},Contents:Array.from(X).map((Z)=>{const Y=Q(Z,"LastModified");return{ETag:Q(Z,"ETag"),Key:Q(Z,"Key"),LastModified:Y?new Date(Y):void 0}}),KeyCount:parseInt(Q(J,"KeyCount")),ContinuationToken:Q(J,"ContinuationToken"),NextContinuationToken:Q(J,"NextContinuationToken"),StartAfter:Q(J,"StartAfter")}};var x=async(z,{retries:$=Number.MAX_VALUE,delay:J=100,max_delay:X=1e4}={})=>{try{return await z()}catch(Q){if($>0)return await new Promise((Z)=>setTimeout(Z,J)),x(z,{retries:$-1,max_delay:X,delay:Math.min(J*1.5,X)});throw Q}};class m{z;$;J;constructor(z,$,J){this.fetch=z;this.endpoint=$;this.mps3=J}getUrl(z,$,J){return`${this.endpoint}/${z}${$?`/${encodeURIComponent($)}`:""}${J||""}`}async listObjectV2(z){for(let $=0;$<10;$++){const J=this.getUrl(z.Bucket,void 0,`/?list-type=2&prefix=${z.Prefix}&start-after=${z.StartAfter}`),X=await x(()=>this.fetch(J,{}));if(X.status===200)return Q0(await X.text(),this.mps3.config.parser);else if(X.status===429)console.warn("listObjectV2: 429, retrying"),await new Promise((Q)=>setTimeout(Q,1000));else throw new Error(`Unexpected response: ${X.status} ${await X.text()}`)}throw new Error("Cannot contact server")}async putObject({Bucket:z,Key:$,Body:J,ChecksumSHA256:X}){const Q=this.getUrl(z,$),Z=await x(()=>p(this.fetch(Q,{method:"PUT",body:J,headers:{"Content-Type":"application/json"}}),this.mps3.config));if(Z.status!==200)throw new Error(`Failed to PUT: ${await Z.text()}`);return{$metadata:{httpStatusCode:Z.status},Date:new Date(Z.headers.get("date")),ETag:Z.headers.get("ETag"),...Z.headers.get("x-amz-version-id")&&{VersionId:Z.headers.get("x-amz-version-id")}}}async deleteObject({Bucket:z,Key:$}){return{$metadata:{httpStatusCode:(await x(()=>this.fetch(this.getUrl(z,$),{method:"DELETE"}))).status}}}async getObject({Bucket:z,Key:$,VersionId:J,IfNoneMatch:X}){const Q=this.getUrl(z,$,J?`?versionId=${J}`:""),Z=await x(()=>p(this.fetch(Q,{method:"GET",headers:{"If-None-Match":X}}),this.mps3.config));switch(Z.status){case 404:return{$metadata:{httpStatusCode:404}};case 403:throw new Error("Access denied");default:{let Y;const W=Z.headers.get("content-type"),D=await Z.text();if(W==="application/json"||D&&D!=="")try{Y=JSON.parse(D)}catch(U){throw new Error(`Failed to parse response as JSON ${Q}`)}return{$metadata:{httpStatusCode:Z.status},Body:Y,ETag:Z.headers.get("ETag"),...Z.headers.get("x-amz-version-id")&&{VersionId:Z.headers.get("x-amz-version-id")}}}}}}class j{key;_vals;_keys;constructor(z,$){if(this.key=z,this._vals=new Map,this._keys=new Map,$)for(let[J,X]of $)this.set(J,X)}get size(){return this._vals.size}set(z,$){const J=this.key(z);return this._vals.set(J,$),this._keys.set(J,z),this}get(z){return this._vals.get(this.key(z))}delete(z){const $=this.key(z);return this._keys.delete($),this._vals.delete($)}has(z){return this._vals.has(this.key(z))}values(){return this._vals.values()}keys(){return this._keys.values()}forEach(z){return this._vals.forEach(($,J,X)=>z($,this._keys.get(J)))}}var E=function(z){return new Promise(($,J)=>{z.oncomplete=z.onsuccess=()=>$(z.result),z.onabort=z.onerror=()=>J(z.error)})},M=function(z,$){const J=indexedDB.open(z);J.onupgradeneeded=()=>J.result.createObjectStore($);const X=E(J);return(Q,Z)=>X.then((Y)=>Z(Y.transaction($,Q).objectStore($)))},w=function(){if(!d)d=M("keyval-store","keyval");return d},A=function(z,$=w()){return $("readonly",(J)=>E(J.get(z)))},V=function(z,$,J=w()){return J("readwrite",(X)=>{return X.put($,z),E(X.transaction)})};var Z0=function(z,$=w()){return $("readonly",(J)=>Promise.all(z.map((X)=>E(J.get(X)))))};var Y0=function(z,$=w()){return $("readwrite",(J)=>{return J.delete(z),E(J.transaction)})},h=function(z,$=w()){return $("readwrite",(J)=>{return z.forEach((X)=>J.delete(X)),E(J.transaction)})};var B0=function(z,$){return z.openCursor().onsuccess=function(){if(!this.result)return;$(this.result),this.result.continue()},E(z.transaction)},S=function(z=w()){return z("readonly",($)=>{if($.getAllKeys)return E($.getAllKeys());const J=[];return B0($,(X)=>J.push(X.key)).then(()=>J)})};var d;var j0=6,W0=(z)=>`write-${z.toString().padStart(j0,"0")}`;class y{session=N();proposedOperations=new Map;operationLabels=new Map;db;lastIndex=0;load=void 0;op=0;constructor(z){this.db=z}async propose(z,$,J=!1){if(this.proposedOperations.set(z,[$,this.op++]),this.db){if(this.load&&!J)await this.load,this.proposedOperations.delete(z),this.proposedOperations.set(z,[$,this.op-1]);this.lastIndex++;const X=W0(this.lastIndex);z[this.session]=this.lastIndex,await V(X,[...$.entries()].map(([Q,Z])=>[JSON.stringify(Q),Z]),this.db),console.log(`STORE ${X} ${JSON.stringify([...$.entries()])}`)}}async label(z,$,J=!1){if(this.operationLabels.set($,z),this.db){if(this.load&&!J)await this.load;const X=z[this.session];if(X===void 0)throw new Error("Cannot label an unproposed operation");const Q=`label-${X}`;await V(Q,$,this.db),console.log(`STORE ${Q} ${$}`)}}async confirm(z,$=!1){if(this.operationLabels.has(z)){const J=this.operationLabels.get(z);if(this.proposedOperations.delete(J),this.operationLabels.delete(z),this.db){if(this.load&&!$)await this.load;const X=J[this.session],Q=[W0(X),`label-${X}`];await h(Q,this.db),console.log(`DEL ${Q}`)}}}async cancel(z,$=!1){if(this.operationLabels.forEach((J,X)=>{if(J===z)this.operationLabels.delete(X)}),this.proposedOperations.delete(z),this.db){if(this.load&&!$)await this.load;const J=z[this.session];await h([`write-${J}`,`label-${J}`],this.db)}}async flatten(){if(this.load)await this.load;const z=new j(C);return this.proposedOperations.forEach(([$,J])=>{$.forEach((X,Q)=>{z.set(Q,[X,J])})}),z}async restore(z,$){return this.db=z,this.proposedOperations.clear(),this.operationLabels.clear(),this.lastIndex=0,this.load=new Promise(async(J)=>{const Q=(await S(this.db)).filter((Y)=>Y.startsWith("write-")).sort();console.log("RESTORE",Q);const Z=await Z0(Q,this.db);for(let Y=0;Y<Q.length;Y++){const W=parseInt(Q[Y].split("-")[1]);this.lastIndex=Math.max(this.lastIndex,W)}for(let Y=0;Y<Q.length;Y++){const W=Q[Y],D=parseInt(W.split("-")[1]),U=Z[Y].map(([G,O])=>[JSON.parse(G),O]),P=await A(`label-${D}`,this.db);if(!U)continue;const F=new Map(U);await $(F,P),await h([`write-${D}`,`label-${D}`],this.db)}J(void 0)}),this.load}}function l(z,$){if($===void 0)return z;if($===null)return;if(typeof $!=="object"||typeof z!=="object")return $;const J=typeof z==="object"?{...z}:{};for(let X in $)if($[X]===null)delete J[X];else J[X]=l(z[X],$[X]);return J}var u=(z)=>JSON.parse(JSON.stringify(z));var c=5000;var i="manifest",n={files:{},update:{}};class B{z;session_id=N().substring(0,3);latest_key=".";latest_state=u(n);loading;cache;db;latest_timestamp=0;writes=0;static manifestRegex=/@([0-9a-z]+)_[0-9a-z]+_[0-9a-z]{2}$/;constructor(z){this.manifest=z}static manifestTimestamp=(z)=>{const $=z.match(B.manifestRegex);if(!$)return 0;return X0($[1],42)};static isValid(z,$){if(!z.match(B.manifestRegex))return console.warn(`Rejecting manifest key ${z}`),!1;if($===void 0)return!0;const X=this.manifestTimestamp(z),Q=$,Z=Math.abs(X-Q.getTime())<c;if(!Z)console.warn(`Clock skew detected ${z} vs ${Q.getTime()}`);return Z}generate_manifest_key(){return R(Math.max(Date.now()+this.manifest.service.config.clockOffset,this.latest_timestamp))+"_"+this.session_id+"_"+J0(this.writes++)}async restore(z){this.db=z,this.loading=A(i,z).then(($)=>{if($)this.latest_state=$,this.manifest.service.config.log(`RESTORE ${i}`)})}async getLatest(){if(this.loading)await this.loading;if(this.loading=void 0,!this.manifest.service.config.online)return this.latest_state;try{let z=void 0;if(this.manifest.service.config.minimizeListObjectsCalls){const Y=await this.manifest.service._getObject({operation:"POLL_LATEST_CHANGE",ref:this.manifest.ref,ifNoneMatch:this.cache?.etag,useCache:!1});if(Y.$metadata.httpStatusCode===304)return this.latest_state;z=Y.ETag}const $=`${this.manifest.ref.key}@${R(Date.now()+this.manifest.service.config.clockOffset+1e4)}`,[J,X]=await L(this.manifest.service.s3ClientLite.listObjectV2({Bucket:this.manifest.ref.bucket,Prefix:this.manifest.ref.key+"@",StartAfter:$})),Q=J.Contents?.filter((Y)=>{if(!B.isValid(Y.Key,Y.LastModified)){if(this.manifest.service.config.autoclean)this.manifest.service._deleteObject({operation:"CLEANUP",ref:{bucket:this.manifest.ref.bucket,key:Y.Key}});return!1}return!0});if(this.manifest.service.config.log(`${X}ms LIST ${this.manifest.ref.bucket}/${this.manifest.ref.key} from ${$}`),Q===void 0)return this.latest_state=u(n),this.latest_state;if(this.latest_timestamp=Math.max(this.latest_timestamp,B.manifestTimestamp(this.latest_key)),Q.length>0){this.latest_key=Q[0].Key;const Y=await this.manifest.service._getObject({operation:"GET_LATEST",ref:{bucket:this.manifest.ref.bucket,key:this.latest_key}});this.latest_state=Y.data}const Z=`${this.manifest.ref.key}@${R(Math.max(B.manifestTimestamp(this.latest_key)-c,0))}`;for(let Y=Q.length-1;Y>=0;Y--){const W=Q[Y].Key;if(W>this.latest_key&&W>Z){if(this.manifest.service.config.autoclean)this.manifest.service._deleteObject({operation:"CLEANUP",ref:{bucket:this.manifest.ref.bucket,key:W}});continue}const D=await this.manifest.service._getObject({operation:"REPLAY",ref:{bucket:this.manifest.ref.bucket,key:W}}),U=W.substring(W.lastIndexOf("@")+1);this.latest_state=l(this.latest_state,D.data?.update),this.manifest.observeVersionId(U)}if(this.db)V(i,this.latest_state,this.db);return this.latest_state}catch(z){if(z.name==="NoSuchKey")return this.latest_state=n,this.latest_state;else throw z}}updateContent(z,$,J){let X=this.generate_manifest_key();const Q=this.manifest.operationQueue.propose($,z,J.isLoad),Z=Q.then(async()=>{try{const Y=await $;let W,D,U=!1;do{const P=await this.getLatest();P.update={files:{}};for(let[G,O]of Y){const I=C(G);if(O){const _={version:O,replication:J.keys.get(G)?.replication||""};P.update.files[I]=_}else P.update.files[I]=null}D=this.manifest.ref.key+"@"+X,this.manifest.operationQueue.label($,X,J.isLoad);const F=await this.manifest.service._putObject({operation:"PUT_MANIFEST",ref:{key:D,bucket:this.manifest.ref.bucket},value:P});if(this.manifest.service.config.adaptiveClock&&!B.isValid(D,F.Date))this.manifest.service.config.clockOffset=F.Date.getTime()-Date.now()+F.latency,console.log(this.manifest.service.config.clockOffset),X=this.generate_manifest_key(),U=!0;else U=!1}while(U);if(this.manifest.service.config.minimizeListObjectsCalls)W=await this.manifest.service._putObject({operation:"TOUCH_LATEST_CHANGE",ref:{key:this.manifest.ref.key,bucket:this.manifest.ref.bucket},value:""});return this.manifest.poll(),W}catch(Y){throw console.error(Y),this.manifest.operationQueue.cancel($,J.isLoad),Y}});if(J.await==="local")return Q;else return Z}}class D0{z;$;J;queue=Promise.resolve();constructor(z,$,J){this.ref=z;this.handler=$;this.lastVersion=J}notify(z,$,J){this.queue=this.queue.then(()=>J).then((X)=>{if($!==this.lastVersion)z.config.log(`${z.config.label} NOTIFY ${C(this.ref)} ${$}`),this.lastVersion=$,this.handler(X)})}}class a{z;$;subscribers=new Set;poller;pollInProgress=!1;syncer=new B(this);operationQueue=new y;constructor(z,$){this.service=z;this.ref=$;console.log("Create manifest",C($))}load(z){this.syncer.restore(z),this.operationQueue.restore(z,async($,J)=>{if(!J)await this.service._putAll($,{manifests:[this.ref],await:"local",isLoad:!0});else await this.updateContent($,Promise.resolve(new Map([[this.ref,J]])),{await:"local",isLoad:!0})})}observeVersionId(z){this.operationQueue.confirm(z)}async poll(){if(this.pollInProgress)return;if(this.pollInProgress=!0,this.subscriberCount===0&&this.poller)clearInterval(this.poller),this.poller=void 0;if(this.subscriberCount>0&&!this.poller)this.poller=setInterval(()=>this.poll(),this.service.config.pollFrequency);const z=await this.syncer.getLatest();if(z===void 0){this.pollInProgress=!1;return}const $=await this.operationQueue.flatten();this.subscribers.forEach(async(J)=>{if($.has(J.ref)){const[X,Q]=$.get(J.ref);J.notify(this.service,`local-${Q}`,Promise.resolve(X))}else{const X=z.files[C(J.ref)];if(X){const Q=this.service._getObject({operation:"GET_CONTENT",ref:J.ref,version:X.version});J.notify(this.service,X.version,Q.then((Z)=>Z.data))}else if(X===null)J.notify(this.service,void 0,Promise.resolve(void 0))}}),this.pollInProgress=!1}updateContent(z,$,J){return this.syncer.updateContent(z,$,J)}async getVersion(z){return(await this.syncer.getLatest()).files[C(z)]?.version}subscribe(z,$){this.service.config.log(`SUBSCRIBE ${C(z)} ${this.subscriberCount+1}`);const J=new D0(z,$);return this.subscribers.add(J),()=>this.subscribers.delete(J)}get subscriberCount(){return this.subscribers.size}}var U0=async(z,$)=>{const J=new URL(z),X=new URLSearchParams(J.search),Q=J.pathname.split("/"),Z=Q[1],Y=Q.slice(2).join("/"),W=M(Z,"v0");let D,U=200;if(X.get("list-type")){const P=encodeURIComponent(X.get("prefix")||""),F=encodeURIComponent(X.get("start-after")||"");D=`<ListBucketResult>${(await S(W)).filter((O)=>`${O}`.startsWith(P)&&`${O}`>F).map((O)=>`<Contents><Key>${O}</Key></Contents>`)}</ListBucketResult>`}else if($?.method==="GET")D=await A(Y,W),U=D===void 0?404:200;else if($?.method==="PUT")D=await $.body,await V(Y,D,W);else if($?.method==="DELETE")await Y0(Y,W);else throw new Error;return new Response(D,{status:U})};async function H0(z){const $=(new TextEncoder()).encode(z),J=await crypto.subtle.digest("SHA-256",$);return G0(new Uint8Array(J))}var A0=(z)=>btoa(z);var G0=(z)=>A0(String.fromCharCode(...z));class P0{static LOCAL_ENDPOINT="indexdb:";config;s3ClientLite;manifests=new j(C);memCache=new j((z)=>`${z.Bucket}${z.Key}${z.VersionId}${z.IfNoneMatch}`);diskCache;endpoint;constructor(z){if(this.config={...z,label:z.label||"default",useChecksum:z.useChecksum===!1?!1:!0,autoclean:z.autoclean===!1?!1:!0,online:z.online===!1?!1:!0,offlineStorage:z.offlineStorage===!1?!1:!0,useVersioning:z.useVersioning||!1,pollFrequency:z.pollFrequency||1000,clockOffset:Math.floor(z.clockOffset)||0,adaptiveClock:z.adaptiveClock===!1?!1:!0,minimizeListObjectsCalls:z.minimizeListObjectsCalls===!1?!1:!0,parser:z.parser||new DOMParser,defaultManifest:{bucket:z.defaultManifest?.bucket||z.defaultBucket,key:typeof z.defaultManifest=="string"?z.defaultManifest:z.defaultManifest?.key||"manifest.json"},log:(...J)=>(z.log===!0?console.log:z.log||(()=>{}))(this.config.label,...J)},this.config.s3Config?.credentials instanceof Function)throw Error("We can't do that yet");this.endpoint=z.s3Config.endpoint||`https://s3.${z.s3Config.region}.amazonaws.com`;let $;if(this.config.s3Config?.credentials){const J=new k({accessKeyId:this.config.s3Config.credentials.accessKeyId,secretAccessKey:this.config.s3Config.credentials.secretAccessKey,sessionToken:this.config.s3Config.credentials.sessionToken,region:this.config.s3Config.region||"us-east-1",service:"s3",retries:0});$=(...X)=>J.fetch(...X)}else if(this.endpoint==P0.LOCAL_ENDPOINT)$=U0;else $=(global||window).fetch.bind(global||window);if(this.config.offlineStorage){const J=`mps3-${this.config.label}`;this.diskCache=M(J,"v0")}this.s3ClientLite=new m(this.config.online?$:()=>new Promise(()=>{}),this.endpoint,this)}getOrCreateManifest(z){if(!this.manifests.has(z)){const $=new a(this,z);if(this.manifests.set(z,$),this.config.offlineStorage){const J=`mps3-${this.config.label}-${z.bucket}-${z.key}`,X=M(J,"v0");this.config.log(`Restoring manifest from ${J}`),$.load(X)}}return this.manifests.get(z)}async get(z,$={}){const J={...this.config.defaultManifest,...$.manifest},X=this.getOrCreateManifest(J),Q={bucket:z.bucket||this.config.defaultBucket||this.config.defaultManifest.bucket,key:typeof z==="string"?z:z.key},Z=await X.operationQueue.flatten();if(Z.has(Q))return this.config.log(`GET (cached) ${Q} ${Z.get(Q)}`),Z.get(Q)[0];const Y=await X.getVersion(Q);if(Y===void 0)return;return(await this._getObject({operation:"GET",ref:Q,version:Y})).data}async _getObject(z){let $;if(this.config.useVersioning)$={Bucket:z.ref.bucket,Key:z.ref.key,IfNoneMatch:z.ifNoneMatch,...z.version&&{VersionId:z.version}};else $={Bucket:z.ref.bucket,Key:`${z.ref.key}${z.version?`@${z.version}`:""}`,IfNoneMatch:z.ifNoneMatch};const J=`${$.Bucket}${$.Key}${$.VersionId}`;if(z.useCache!==!1){if(this.memCache.has($))return this.memCache.get($);if(this.diskCache){const Q=await A(J,this.diskCache);if(Q)return this.config.log(`${z.operation} (disk cached) ${J}`),this.memCache.set($,Promise.resolve(Q)),Q}}if(!this.config.online)throw new Error(`${this.config.label} Offline and value not cached for ${J}`);const X=L(this.s3ClientLite.getObject($)).then(async([Q,Z])=>{const Y={$metadata:Q.$metadata,ETag:Q.ETag,data:Q.Body};return this.config.log(`${Z}ms ${z.operation} ${z.ref.bucket}/${z.ref.key}@${z.version} => ${Y.VersionId}`),Y}).catch((Q)=>{if(Q?.name==="304")return{$metadata:{httpStatusCode:304},data:void 0};else throw Q});if(z.useCache!==!1){if(this.memCache.set($,X),this.diskCache)X.then((Q)=>{V(`${$.Bucket}${$.Key}${$.VersionId}`,Q,this.diskCache).then(()=>this.config.log(`STORE ${$.Bucket}${$.Key}`))})}return X}async delete(z,$={}){return this.putAll(new Map([[z,void 0]]),$)}async put(z,$,J={}){return this.putAll(new Map([[z,$]]),J)}async putAll(z,$={}){const J=new Map([...z].map(([Z,Y])=>[{bucket:Z.bucket||this.config.defaultBucket||this.config.defaultManifest.bucket,key:typeof Z==="string"?Z:Z.key},Y])),X=($?.manifests||[this.config.defaultManifest]).map((Z)=>({...this.config.defaultManifest,...Z})),Q=$.keys?new j(C,[...$.keys].map(([Z,Y])=>[{bucket:Z.bucket||this.config.defaultBucket||this.config.defaultManifest.bucket,key:typeof Z==="string"?Z:Z.key},Y])):new j(C);return this._putAll(J,{manifests:X,keys:Q,await:$.await||this.config.online?"remote":"local"})}async _putAll(z,$){const J=new Map,X=new Promise(async(Q,Z)=>{const Y=new Map,W=[];z.forEach((D,U)=>{if(D!==void 0){let P=this.config.useVersioning?void 0:N();J.set(U,D),W.push(this._putObject({operation:"PUT_CONTENT",ref:U,value:D,version:P}).then((F)=>{if(this.config.useVersioning)if(F.VersionId===void 0)throw console.error(F),Error(`Bucket ${U.bucket} is not version enabled!`);else P=F.VersionId;Y.set(U,P)}))}else W.push(this._deleteObject({ref:U}).then((P)=>{Y.set(U,void 0)}))}),await Promise.all(W).catch(Z),Q(Y)});return Promise.all($.manifests.map((Q)=>{return this.getOrCreateManifest(Q).updateContent(J,X,{keys:$.keys,await:$.await,isLoad:$.isLoad===!0})}))}async _putObject(z){const $=JSON.stringify(z.value,null,2);let J={Bucket:z.ref.bucket,Key:this.config.useVersioning?z.ref.key:`${z.ref.key}${z.version?`@${z.version}`:""}`,ContentType:"application/json",Body:$,...this.config.useChecksum&&{ChecksumSHA256:await H0($)}};const[X,Q]=await L(this.s3ClientLite.putObject(J));if(this.config.log(`${Q}ms ${z.operation} ${J.Bucket}/${J.Key} => ${X.VersionId}`),this.diskCache){const Z=`${J.Bucket}${J.Key}${z.version||X.VersionId}`,Y=JSON.parse($);await V(Z,{$metadata:{httpStatusCode:200},etag:X.ETag,data:Y},this.diskCache).then(()=>this.config.log(`STORE ${Z}`))}return{...X,latency:Q}}async _deleteObject(z){const $={Bucket:z.ref.bucket,Key:z.ref.key},[J,X]=await L(this.s3ClientLite.deleteObject($));return this.config.log(`${X}ms ${z.operation||"DELETE"} ${z.ref.bucket}/${z.ref.key} (${J.$metadata.httpStatusCode})}`),J}subscribe(z,$,J){const X={...this.config.defaultManifest,...J?.manifest},Q={key:typeof z==="string"?z:z.key,bucket:z.bucket||this.config.defaultBucket||X.bucket},Z=this.getOrCreateManifest(X),Y=Z.subscribe(Q,$);return this.get(Q,{manifest:X}).then((W)=>{this.config.log(`NOTIFY (initial) ${C(Q)}`),queueMicrotask(()=>{$(W,void 0),Z.poll()})}).catch((W)=>{$(void 0,W)}),Y}refresh(){return Promise.all([...this.manifests.values()].map((z)=>z.poll()))}get subscriberCount(){return[...this.manifests.values()].reduce((z,$)=>z+$.subscriberCount,0)}shutdown(){this.manifests.forEach((z)=>{z.subscribers.forEach(($)=>{z.subscribers.delete($)})})}}export{P0 as MPS3};
