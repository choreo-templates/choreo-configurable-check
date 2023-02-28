const core = require('@actions/core');
// const github = require('@actions/github');
const fs = require('fs');
const toml = require('toml');
var json2toml = require('json2toml');
var enums = require('./enums');

try {
    //const configSchemaData = JSON.parse(fs.readFileSync(`target/bin/config-schema.json`, 'utf-8'));
    const configSchemaData = JSON.parse(fs.readFileSync(`inputs/config-schema.json`, 'utf-8'));
    const configNames = JSON.parse(fs.readFileSync(`inputs/input.json`, 'utf-8'));
    const dataF = core.getInput('configInput');
    const appName = core.getInput('appName');
    const appId = core.getInput('appId');
    const envId = core.getInput('envId');
    const apiVersionId = core.getInput('versionId');
    const commitId = core.getInput('commitId');
    const runId = core.getInput('runId');
    const alertProxyUrl = core.getInput('alertProxyURL');

    ///
    let configNamesd = [];
    for (l of configNames['configurationMount']) {
        configNamesd.push({'key':l['configKeyName'], 'type':l['valueType']})
    }
    const configName = {'data': configNamesd}
    ////


    if (Object.keys(configSchemaData['properties']).length == 0) {
        console.log("Configurables not detected in latest code. skipping configurable check");
        return;
    }

    let orgName;

    Object.keys(configSchemaData['properties']).forEach(element => {
        orgName = element;
    });
    if (!orgName) {
        console.log("No organizations found in the generated config-schema. skipping configurable check");
        return;
    }

    const moduleList = Object.keys(configSchemaData['properties'][orgName]['properties']);
    const configurableData = configSchemaData['properties'][orgName]['properties'][moduleList[0]];

    const reqArray = flattenSchemaReq(configurableData['properties'], '', [], configurableData['required']);
    const allArray = flattenSchema(configurableData['properties'], '', []);
    const nonReqArray = reduceArray(allArray, reqArray);
    configMatch = arrayCompare(configNames['data'], reqArray);
    const configMatch = arrayCompare(configName['data'], reqArray);
    console.log(configName['data']);
    console.log(reqArray);
    console.log(configMatch);

    if (configMatch) {
        let successMsg = "Configurable Check Success";
        console.log(successMsg);
    } else {
        let errMsg = "Error Occurred: Configurable fields doesn't match, Please retry a manual deployment providing all the corresponding configurable values"          
        if(reduceArray(reqArray, configNames['data']).length == 0) {
            const resultArray = reduceArray(configNames['data'], reqArray)
            if (resultArray.length > 0) {
                let checkResult = true;
                for (i of resultArray) {
                    if (!objExistsInArray(i, nonReqArray)) {
                        checkResult = false;
                    }
                }
                if(!checkResult) {
                    console.log(errMsg);
                    sendAlert();
                    return errMsg;
                } else {
                    let successMsg = "Configurable Check Success";
                    console.log(successMsg);
                }
            } else {
                console.log(errMsg);
                sendAlert();
                return errMsg;
            }
        } else {
            console.log(errMsg);
            sendAlert();
            return errMsg;
        }
    }

} catch (error) {
    console.log(error, "Ballerinal.toml not found!");
}

function objExistsInArray(inputObj, inputArray){
    let result = false;
    for(element of inputArray) {
        if (inputObj["key"] == element["key"] && inputObj["type"] == element["type"]) {
            result = true;
            break;
        }
    }
    return result;
}

function arrayCompare(a, b) {
    let result = true;
    for (i of Object.keys(a)) {
        if(!objExistsInArray(a[i], b)){
            result = false;
            break;
        }
    }
    for (j of Object.keys(b)) {
        if(!objExistsInArray(b[j], a)){
            result = false;
            break;
        }
    }
    return result;
}

function reduceArray(a, b) {
    result = [];
    for(k of a) {
        if(!objExistsInArray(k, b)) {
            result.push(k);
        }
    }
    return result;
}


function flattenSchemaReq(iterObj, inKey, dots, reqFields) {
    if (iterObj !== null && typeof (iterObj) === 'object' && !Array.isArray(iterObj)) {
        for (let key of Object.keys(iterObj)) {
            console.log("Iterating : " + key);
            if (reqFields.length > 0 && reqFields.includes(key)) {
                if (typeof (iterObj[key]) === 'object' && 'properties' in iterObj[key]) {
                    console.log("Has Properties for : " + key);
                    if ('required' in iterObj[key]) {
                        console.log("Has Required for : " + key);
                        flattenSchemaReq(iterObj[key]['properties'], inKey === '' ? key : inKey + '.' + key , dots, iterObj[key]['required']);
                    } else {
                        flattenSchemaReq(iterObj[key]['properties'], inKey === '' ? key : inKey + '.' + key , dots, []);
                    }
                } else {
                    console.log("No Properties for : " + key);
                    val = '';
                    if(iterObj[key] !== null && typeof (iterObj[key]) === 'object' && !Array.isArray(iterObj[key]) && key !== 'items') {
                        val = (inKey === '') ? key : '.' + key ;
                        console.log("No Properties but object : " + inKey + val);
                        flattenSchemaReq(iterObj[key], inKey + val, dots, []);
                    } else {
                        console.log("No Properties Not object : " + key);
                        if(key == 'type' || key == 'properties' || key == 'anyOf' || key == 'enum') {
                            flattenSchemaReq(iterObj[key], inKey + val, dots, []);
                        }
                    }
                }
            } else if (reqFields.length == 0) {
                console.log("No Properties for : " + key);
                val = '';
                if(iterObj[key] !== null && typeof (iterObj[key]) === 'object' && !Array.isArray(iterObj[key]) && key !== 'items') {
                    val = (inKey === '') ? key : '.' + key ;
                    console.log("No Properties but object : " + inKey + val);
                    flattenSchemaReq(iterObj[key], inKey + val, dots, []);
                } else {
                    console.log("No Properties Not object : " + key);
                    if(key == 'type' || key == 'properties' || key == 'anyOf' || key == 'enum') {
                        flattenSchemaReq(iterObj[key], inKey + val, dots, []);
                    }
                }
            }
        }
    } else if(Array.isArray(iterObj)) {
        console.log("Is array : " + inKey);
        dots.push({'key':inKey, 'type':''});
    } else {
        console.log("Leaf node : " + inKey);
        dots.push({'key':inKey, 'type':iterObj});
    }

    return dots;
}

function flattenSchema(iterObj, inKey, dots) {
    if (iterObj !== null && typeof (iterObj) === 'object' && !Array.isArray(iterObj)) {
        for (let key of Object.keys(iterObj)) {
            console.log("Iterating : " + key);
            if (typeof (iterObj[key]) === 'object' && 'properties' in iterObj[key]) {
                console.log("Has Properties for : " + key);
                flattenSchema(iterObj[key]['properties'], inKey === '' ? key : inKey + '.' + key , dots);
            } else {
                console.log("No Properties for : " + key);
                val = '';
                if(iterObj[key] !== null && typeof (iterObj[key]) === 'object' && !Array.isArray(iterObj[key]) && key !== 'items') {
                    val = (inKey === '') ? key : '.' + key ;
                    console.log("No Properties but object : " + inKey + val);
                    flattenSchema(iterObj[key], inKey + val, dots);
                } else {
                    console.log("No Properties Not object : " + key);
                    if(key == 'type' || key == 'properties' || key == 'anyOf' || key == 'enum') {
                        flattenSchema(iterObj[key], inKey + val, dots, []);
                    }
                }
            }
        }
    } else if(Array.isArray(iterObj)) {
        console.log("Is array : " + inKey);
        dots.push({'key':inKey, 'type':''});
    } else {
        console.log("Leaf node : " + inKey);
        dots.push({'key':inKey, 'type':iterObj});
    }

    return dots;
}

function sendAlert() {
    if(alertProxyUrl != "") {
        const data = {
            "app_id": appId,
            "environment_id": envId,
            "api_version_id": apiVersionId,
            "commitId": commitId,
            "runId": int(runId),
            "failureReason": 1
        }

        // POST call to alert proxy url
        console.log("Alerting Status : " + response.status);
        console.log("Alerting Response : " + response.read().decode());
    }   
}
