const BlockChain = require('./Core').BlockChain
const BlockHeader = require('./Core').BlockHeader
const BlockData = require('./Core').BlockData
const Crypto = require('./Crypto')
const Const = require('./Const')

var globalBlockChain = new BlockChain();
// genFistBlock()
globalBlockChain.Initiate(() => {});

const express = require('express');
const bodyParser = require('body-parser');

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json())
app.use(express.urlencoded({extended: false}));

app.listen(process.env.PORT || 3000);

app.get('/new-wallet', (req, res) => {
	var priv = Crypto.GetKey()
	res.json({
		code: Const.SUCCESS,
		message: "Successful",
		data: {
			privateKey: priv,
			pubKeyHash: Crypto.GetPubKeyHash(priv)
		}
	})
})

app.get('/balance', (req, res) => {
	var pubKeyHash = req.query.id
	var wallet = globalBlockChain.walletDictionary[pubKeyHash]
	res.json({
		code: Const.SUCCESS,
		message: "Successfull",
		data: {
			balance: wallet.GetTotalMoney()
		}
	})
})

app.post('/transaction', (req, res) => {
	var privateKey = req.body.privateKey
	var sender = req.body.sender
	var receiver = req.body.receiver
	var amount = req.body.amount
	var message = req.body.message

	createTransaction(privateKey, sender, receiver, amount, message);

	res.json({
		code: Const.SUCCESS,
		message: "Successful"
	})
})

app.get('/transactions', (req, res) => {
	var pubKeyHash = req.query.id

	// Get all tx job
	var job = [];
	for (var i = 0; i < globalBlockChain.GetLength(); i++) {
		job.push(globalBlockChain.GetData(globalBlockChain.GetHeader(i).GetHash()))
	}

	// Find history
	Promise.allSettled(job)
	.then((result) => {
		var txs = {};
		result.forEach(element => {
			txs[Crypto.Sha256(JSON.stringify(element.value.blockData.txs[0]))] = element.value.blockData.txs[0]
		});

		var his = []
		for (var key in txs) {
			var sender;
			var txIns = txs[key].txIns
			if (txIns) {
				sender = txs[txs[key].txIns[0].preHashTx].txOuts[txs[key].txIns[0].outputIndex].pubKeyHash
			} else {
				sender = "SYSTEM"
			}

			console.log(sender)
			console.log(pubKeyHash)

			var receiver = txs[key].txOuts[0].pubKeyHash
			var amount = txs[key].txOuts[0].money
			var message = txs[key].message

			if (sender == pubKeyHash || receiver == pubKeyHash) {
				his.push({
					sender: sender,
					receiver: receiver,
					amount: amount,
					message: message
				})
			}
		}

		res.json({
			code: Const.SUCCESS,
			message: "Sucessful",
			data: his
		})
	})
})

function genFistBlock() {
	var headers = new BlockHeader({
		index: 0,
		preBlockHash: "",
		nonce: 69732
	})
	var datas = new BlockData([
		{
			txOuts: [
				{
					pubKeyHash: "1e095aff6eef007cb07577f0646e31b3756e6fe8d505462b477cdd273bc2243a",
					money: 1000000
				},
				{
					pubKeyHash: "2dedf231bb53757027f475dc6a37259348004875cc9882df46b8e1ce3a36c773",
					money: 1000000
				}
			]
		}
	])
	globalBlockChain.AddBlock(headers, datas);
}

function createTransaction(privateKey, sender, receiver, amount, message) {
	// create blockHeader
	var blockHeader = new BlockHeader({
		index: globalBlockChain.GetLength(),
		preBlockHash: globalBlockChain.GetHeader(globalBlockChain.GetLength() - 1).GetHash(),
		nonce: 0
	})

	// mine
	var nonce = 0;
	while (!blockHeader.GetHash().startsWith("0000")) {
		nonce++;
		blockHeader.nonce = nonce;
	}

	// create blockdata
	var utxo = globalBlockChain.walletDictionary[sender].GetUtxos()
	var txIns = JSON.parse(JSON.stringify(utxo));
	var txOuts = [
		{
			pubKeyHash: receiver,
			money: amount
		},
		{
			pubKeyHash: sender,
			money: globalBlockChain.walletDictionary[sender].GetTotalMoney() - amount
		}
	]

	var blockData = new BlockData([
		{
			txIns: txIns,
			txOuts: txOuts,
			message: message,
			senderSign: Crypto.Sign(privateKey, "")
		}
	])

	// add block
	globalBlockChain.AddBlock(blockHeader, blockData)
}