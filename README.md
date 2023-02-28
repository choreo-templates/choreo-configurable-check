# Choreo Configurable Check

Checks the generated configurable list against the earlier list

## Example

```
  build:
    steps:
    - name: Choreo Configurable Check
      uses: choreo-templates/choreo-configurable-check@v1
      with:
       configInput: ${{secrets.CONFIG_INPUT}}
       appName: ${{secrets.APP_NAME}}
       appId: ${{secrets.APP_ID}}
       envId: ${{secrets.ENV_ID}}
       versionId: ${{secrets.VERSION_ID}}
       commitId: ${{secrets.COMMIT_ID}}
       runId: ${{secrets.RUN_ID}}
       alertProxyURL: ${{secrets.ALERT_PROXY_URL}}
```
