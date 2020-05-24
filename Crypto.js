const sha256 = require('sha256');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

/**
 * Hash chuỗi đầu vào bằng thuật toán Sha256
 * @param {string} s: chuỗi đầu vào
 * @returns {string}: chuỗi mới sau khi hash
 */
function Sha256(s) {
    return sha256(s);
}

/**
 * Ký tên bằng thuật toán ECDSA
 * @param {string} privKey: private key của người ký
 * @param {string} message: thông điệp cần ký
 * @returns {JSON}: đối tượng json chứa các thông tin bao gồm thông điệp gốc (message), public key của người ký (pubKey), chữ ký (signature)
 */
function Sign(privKey, message) {
    var key = ec.keyFromPrivate(privKey, 'hex');
    var messageHash = sha256(message, { asBytes: true });
    return { message: message, pubKey: key.getPublic('hex'), signature: key.sign(messageHash) };
}

/**
 * Kiểm tra chữ ký có hợp lệ không
 * @param {JSON} signature: chữ ký tạo ra bằng hàm Sign ở trên
 * @returns {boolean}: kết quả kiểm tra (đúng/sai)
 */
function Verify(signature) {
    var key = ec.keyFromPublic(signature.pubKey, 'hex');
    var messageHash = sha256(signature.message, { asBytes: true });
    return key.verify(messageHash, signature.signature);
}

/**
 * Tạo private key mới
 * @returns {string}: private key mới
 * */
function GetKey() {
    return ec.genKeyPair().getPrivate('hex');
}

/**
 * Tạo public key hash từ privite key
 * @param {string} privKey
 * @returns {string}
 */
function GetPubKeyHash(privKey) {
	return sha256(ec.keyFromPrivate(privKey).getPublic('hex'));
}

module.exports = { Sha256, Sign, Verify, GetKey, GetPubKeyHash };