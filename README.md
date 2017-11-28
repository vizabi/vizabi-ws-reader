# Vizabi WS reader

Example of adding the compiled WS reader to a web page after vizabi script

```
<script src="libs/vizabi.min.js"></script>
<script src="libs/vizabi-ws-reader.js"></script>
```

Example of integrating WS reader into vizabi

```
//WS reader integration
var wsReader = WsReader.WsReader.getReader();
Vizabi.Reader.extend("waffle", wsReader);
```

Example of configuring WS reader: pointing it to a certain dataset#branch and WS enpoint
`dataset_access_token` is only required for datasets marked as private during import via ws cli
`assetsPath` is only requred if we want to use asset queries in vizabi tool
`dataset` is only required when the dataset we want to request is differnet from the one set in WS as default dataset
`#branch` in dataset can be ommitted, then the missing branch is equal to #master

```
VIZABI_MODEL.data = {
  "reader": 'waffle',
  "path": 'https://waffle-server-dev.gapminderdev.org/api/ddf/ql',
  "dataset": 'Gapminder/ddf--my--dataset--repo#branch',
  "assetsPath": 'https://import-waffle-server-dev.gapminderdev.org/api/ddf/assets/',
  "dataset_access_token": "aaaaaaabbbbbbbccccccdddddddeeeeeefffffff11112222333444556677890"
};
```
