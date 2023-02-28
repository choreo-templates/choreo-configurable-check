const core = require('@actions/core');
const axios = require('axios').default;
const fs = require('fs');

try {
    const configSchemaData = JSON.parse(fs.readFileSync(`target/bin/config-schema.json`, 'utf-8'));
    const dataF = core.getInput('configInput');
    const configName = JSON.parse(dataF);
    const appName = core.getInput('appName');
    const appId = core.getInput('appId');
    const envId = core.getInput('envId');
    const apiVersionId = core.getInput('versionId');
    const commitId = core.getInput('commitId');
    const runId = core.getInput('runId');
    const alertProxyUrl = core.getInput('alertProxyURL');

    console.log("Processing existing input : " + configName);
    console.log("Processing new input : " + configSchemaData);

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
    const configMatch = arrayCompare(configName['data'], reqArray);

    if (configMatch) {
        let successMsg = "Configurable Check Success";
        console.log(successMsg);
    } else {
        let errMsg = "Error Occurred: Configurable fields doesn't match, Please retry a manual deployment providing all the corresponding configurable values"          
        if(reduceArray(reqArray, configName['data']).length == 0) {
            const resultArray = reduceArray(configName['data'], reqArray)
            if (resultArray.length > 0) {
                let checkResult = true;
                for (i of resultArray) {
                    if (!objExistsInArray(i, nonReqArray)) {
                        checkResult = false;
                    }
                }
                if(!checkResult) {
                    console.log(errMsg);
                    sendAlert(alertProxyUrl, appId, envId, apiVersionId, commitId, runId);
                    return errMsg;
                } else {
                    let successMsg = "Configurable Check Success";
                    console.log(successMsg);
                }
            } else {
                console.log(errMsg);
                sendAlert(alertProxyUrl, appId, envId, apiVersionId, commitId, runId);
                return errMsg;
            }
        } else {
            console.log(errMsg);
            sendAlert(alertProxyUrl, appId, envId, apiVersionId, commitId, runId);
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
            if (reqFields.length > 0 && reqFields.includes(key)) {
                if (typeof (iterObj[key]) === 'object' && 'properties' in iterObj[key]) {
                    if ('required' in iterObj[key]) {
                        flattenSchemaReq(iterObj[key]['properties'], inKey === '' ? key : inKey + '.' + key , dots, iterObj[key]['required']);
                    } else {
                        flattenSchemaReq(iterObj[key]['properties'], inKey === '' ? key : inKey + '.' + key , dots, []);
                    }
                } else {
                    val = '';
                    if(iterObj[key] !== null && typeof (iterObj[key]) === 'object' && !Array.isArray(iterObj[key]) && key !== 'items') {
                        val = (inKey === '') ? key : '.' + key ;
                        flattenSchemaReq(iterObj[key], inKey + val, dots, []);
                    } else {
                        if(key == 'type' || key == 'properties' || key == 'anyOf' || key == 'enum') {
                            flattenSchemaReq(iterObj[key], inKey + val, dots, []);
                        }
                    }
                }
            } else if (reqFields.length == 0) {
                val = '';
                if(iterObj[key] !== null && typeof (iterObj[key]) === 'object' && !Array.isArray(iterObj[key]) && key !== 'items') {
                    val = (inKey === '') ? key : '.' + key ;
                    flattenSchemaReq(iterObj[key], inKey + val, dots, []);
                } else {
                    if(key == 'type' || key == 'properties' || key == 'anyOf' || key == 'enum') {
                        flattenSchemaReq(iterObj[key], inKey + val, dots, []);
                    }
                }
            }
        }
    } else if(Array.isArray(iterObj)) {
        dots.push({'key':inKey, 'type':''});
    } else {
        dots.push({'key':inKey, 'type':iterObj});
    }

    return dots;
}

function flattenSchema(iterObj, inKey, dots) {
    if (iterObj !== null && typeof (iterObj) === 'object' && !Array.isArray(iterObj)) {
        for (let key of Object.keys(iterObj)) {
            if (typeof (iterObj[key]) === 'object' && 'properties' in iterObj[key]) {
                flattenSchema(iterObj[key]['properties'], inKey === '' ? key : inKey + '.' + key , dots);
            } else {
                val = '';
                if(iterObj[key] !== null && typeof (iterObj[key]) === 'object' && !Array.isArray(iterObj[key]) && key !== 'items') {
                    val = (inKey === '') ? key : '.' + key ;
                    flattenSchema(iterObj[key], inKey + val, dots);
                } else {
                    if(key == 'type' || key == 'properties' || key == 'anyOf' || key == 'enum') {
                        flattenSchema(iterObj[key], inKey + val, dots, []);
                    }
                }
            }
        }
    } else if(Array.isArray(iterObj)) {
        dots.push({'key':inKey, 'type':''});
    } else {
        dots.push({'key':inKey, 'type':iterObj});
    }

    return dots;
}

function sendAlert(alertProxyUrl, appId, envId, apiVersionId, commitId, runId) {
    if(alertProxyUrl != "") {
        const payload = {
            "app_id": appId,
            "environment_id": envId,
            "api_version_id": apiVersionId,
            "commitId": commitId,
            "runId": parseInt(runId),
            "failureReason": 1
        };

        axios.post(alertProxyUrl, payload).then(function (response) {
            core.setOutput("choreo-configurable-check-alert-status", "sent");
            console.log("choreo-configurable-check-alert-status", "sent");
            console.log("Alerting Status : " + response.status);
          })
          .catch(function (error) {
            core.setOutput("choreo-status", "failed");
            console.log(error);
          });
    }   
}
