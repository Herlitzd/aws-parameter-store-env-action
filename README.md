# AWS ParameterStore Environment Variable Mapper

This action allows for the creation of environment variables inside your
runner from values stored AWS ParameterStore.

This action assumes that your runner is already configured for AWS access with
[aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) or other means. For an example see the action running for this repo [here](https://github.com/Herlitzd/aws-parameter-store-env-action/blob/master/.github/workflows/action_test.yml#L8-L13).

## Action Usage

```yml
  - name: Sets Environment Vars from
    uses: Herlitzd/aws-parameter-store-env-action
    id: Param-Store-Env-Action-Test
    with:
      params-root: "/path1"
      with-decryption: false
      mapping-file: "./test_mappings/test_map1.json"
```

`params-roots` : _`string`_ ParameterStore root path

`with-decryption` : _`boolean`_ `default: false` When `true` Secret String parameters will be decrypted (if the IAM being used has the correct access to do so)

`mapping-file` : _`string`_ Path from the repo's root to json file describing mapping from ParameterStore values to environment variables

The mapping file allows you to specify the name of the environment variable you are setting in your runner for each ParameterStore value.

```json
{
  "my_api_key_env_var": "/ParameterPath/More/Path/ApiKey",
  "my_logging_artifact_key_env_var": "/ParameterPath/Artifacts/Endpoint"
}
```

You can call your environment variables whatever you would like, so long as contain on valid characters for the runner's OS. Note that the mapping file functions as a filter as well, only parameters specified in the mapping file with a valid environment variable name will be mapped.
