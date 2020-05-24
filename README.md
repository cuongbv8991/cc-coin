# Simple coin with blockchain


GET /new-wallet

{
	code: 100,
	message: "Succesful",
	data: {
		privateKey: "asds",
		pubKeyHash: "asds"
	}
}

GET /balance?id=pubKeyHash

{
	code: 100,
	message: "Succesful",
	data: {
		balance: 123123
	}
}

POST /transaction

{
	privateKey: "",
	sender: "",
	receiver: "",
	amount: "",
	message: ""
}

{
	code: 100,
	message: "Succesful",
}

GET /transactions?id=pubKeyHash

{
	code: 100,
	message: "Succesful",
	data: [
		{
			sender: "asdas",
			receiver: "asdasd",
			amount: 123123,
			message: "asdas"
		},
		{
			sender: "asdas",
			receiver: "asdasd",
			amount: 123123,
			message: "asdas"
		}
	]
}
