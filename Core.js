const Crypto = require("./Crypto");
const Const = require("./Const");
const level = require("level");
const db = level(Const.db, { valueEncoding: "json" });

class Wallet {
	constructor(pubKeyHash) {
		this.pubKeyHash = pubKeyHash;
		this.utxos = [];
    }
    
	GetUtxos() {
		return this.utxos;
    }
    
	GetTotalMoney() {
		var totalMoney = 0;
		for (var i = 0; i < this.utxos.length; i++) {
			totalMoney += this.utxos[i].money;
		}
		return totalMoney;
	}
}

class TxIn {
	constructor(obj) {
		this.preHashTx = obj.preHashTx;
		this.outputIndex = obj.outputIndex;
	}
}

class TxOut {
	constructor(obj) {
		this.pubKeyHash = obj.pubKeyHash;
		this.money = obj.money;
	}
}

class Tx {
	constructor(obj) {
		this.txIns = obj.txIns;
		this.txOuts = obj.txOuts;
		this.message = obj.message;
		this.senderSign = obj.senderSign;
	}

	Sign(privKey) {
		var message = {
			txIns: this.txIns,
			txOuts: this.txOuts,
			message: this.message
		};
		this.senderSign = Crypto.Sign(privKey, JSON.stringify(message));
    }
    
	Verify() {
		var message = {
			txIns: this.txIns,
			txOuts: this.txOuts,
			message: this.message
		};
		return Crypto.Verify(this.senderSign)
			&& this.senderSign.message == JSON.stringify(message);
	}
}

class BlockHeader {
	constructor(obj) {
		this.index = obj.index;
        this.preBlockHash = obj.preBlockHash;
        this.nonce = obj.nonce;
    }
    
	Verify() {
		return this.GetHash().startsWith("0000");
    }
    
	GetHash() {
		return Crypto.Sha256(this.index.toString() + this.preBlockHash + this.nonce.toString());
	}
}

class BlockData {
	constructor(txs) {
		this.txs = [];
		for (var i = 0; i < txs.length; i++) {
			this.txs.push(new Tx(txs[i]));
		}
	}
}

class BlockChain {
	constructor() {
		this.headers = [];
		this.walletArray = [];
		this.walletDictionary = {};
    }
    
	Initiate(cb) {
		var tmpArray = [];
		var blockChain = this;
		db.createReadStream().
			on("data", data => {
				tmpArray.push(data.value);
			})
			.on("end", () => {
				tmpArray.sort((a, b) => {
					return a.blockHeader.index - b.blockHeader.index;
				});
				for (var i = 0; i < tmpArray.length; i++) {
					var blockHeader = new BlockHeader(tmpArray[i].blockHeader);
					var blockData = new BlockData(tmpArray[i].blockData.txs);
					blockChain.AddBlock(blockHeader, blockData);
                }
                cb();
			});
	}

	GetHeader(index) {
		if (index < this.headers.length) {
			return this.headers[index];
		}
		return null;
	}

	ValidateBlockHeader(blockHeader, preBlockHeader) {
		if (!blockHeader.Verify()) {
			return false;
		}
		if (blockHeader.index != preBlockHeader.index + 1) {
			return false;
		}
		if (blockHeader.preBlockHash != preBlockHeader.GetHash()) {
			return false;
        }
        
		return true;
	}

	async GetData(blockHeaderHash, cb) {
		return await db.get(blockHeaderHash)
	}

	ValidateTx(tx) {
		if (!tx.Verify()) {
			return false;
		};
		var wallet = this.walletDictionary[Crypto.Sha256(tx.senderSign.pubKey)];
		if (wallet) {
			var totalInput = 0;
			for (var i = 0; i < tx.txIns.length; i++) {
				var utxo = wallet.utxos.find(utxo => {
					return utxo.preHashTx == tx.txIns[i].preHashTx
						&& utxo.outputIndex == tx.txIns[i].outputIndex;
				});
				if (utxo) {
					totalInput += utxo.money;
				} else {
					return false;
				}
			}
			var totalOutput = 0;
			for (var i = 0; i < tx.txOuts.length; i++) {
				totalOutput += tx.txOuts[i].money;
			}
			if (Math.abs(totalInput - totalOutput) > 0.0000000001) {
				return false;
			}
			return true;
		}
		return false;
	}

	ValidateBlockData(blockData) {
		if (blockData.txs.length != 1) {
			return false;
		}
		return true;
	}

	GetUtxos(pubKeyHash) {
		var wallet = this.walletDictionary[pubKeyHash];
		if (wallet) {
			return wallet.utxos;
		}
		return [];
	}

	GetTotalMoney(pubKeyHash) {
		var wallet = this.walletDictionary[pubKeyHash];
		if (wallet) {
			return wallet.GetTotalMoney();
		}
		return 0;
	}

	AddBlock(blockHeader, blockData) {
		this.headers.push(blockHeader);
		db.get(blockHeader.GetHash(), (err, value) => {
			if (err) {
				db.put(blockHeader.GetHash(), {
					blockHeader: blockHeader,
					blockData: blockData
				});
			}
		});
		for (var i = 0; i < blockData.txs.length; i++) {
			if (blockData.txs[i].txIns) {
				var wallet = this.walletDictionary[Crypto.Sha256(blockData.txs[i].senderSign.pubKey)];
				for (var j = 0; j < blockData.txs[i].txIns.length; j++) {
					var utxo = wallet.utxos.find(utxo => {
						return utxo.preHashTx == blockData.txs[i].txIns[j].preHashTx
							&& utxo.outputIndex == blockData.txs[i].txIns[j].outputIndex;
					});
					wallet.utxos.splice(wallet.utxos.indexOf(utxo), 1);
				}
			}
			for (var j = 0; j < blockData.txs[i].txOuts.length; j++) {
				var recvPubKeyHash = blockData.txs[i].txOuts[j].pubKeyHash;
				if (!this.walletDictionary[recvPubKeyHash]) {
					this.walletDictionary[recvPubKeyHash] = new Wallet(recvPubKeyHash);
					this.walletArray.push(recvPubKeyHash);
				}
				var walletRecv = this.walletDictionary[recvPubKeyHash];
				var obj = {
					preHashTx: Crypto.Sha256(JSON.stringify(blockData.txs[i])),
					outputIndex: j,
					money: blockData.txs[i].txOuts[j].money,
				};
				walletRecv.utxos.push(obj);
			}
		}
	}

	GetLength() {
		return this.headers.length;
	}
}
module.exports = { Tx, TxIn, TxOut, Wallet, BlockHeader, BlockData, BlockChain };