const userModel = require("../model/user.model");
const cloudinary = require('../helper/cloudinary');
const { success, failed, successWithToken } = require("../helper/response");

const bcrypt = require("bcrypt");
const jwtToken = require("../helper/generateJWT");

const userController = {
	getUserId: (req, res) => {
		const id = req.params.id;
		userModel
			.selectUserId(id)
			.then((result) => {
				const user = result.rows[0];
				delete user.password;
				success(res, user, "success", "get user success");
			})
			.catch((err) => {
				failed(res, err.message, "failed", "get user failed");
			});
	},

	getAllUser: (req, res) => {
		userModel
			.getAllUser()
			.then((result) => {
				success(res, result.rows, "success", "get all user success");
			})
			.catch((err) => {
				failed(res, err.message, "failed", "get all user failed");
			});
	},

	searchUser: (req, res) => {
		const limit = parseInt(req.query.limit) || 2;
		const page = parseInt(req.query.page) || 1;
		const offset = (page - 1) * limit;
		const username = req.params.username;

		userModel
			.searchUser(username, limit, offset)
			.then((result) => {
				success(res, result.rows, "success", "get user success");
			})
			.catch((err) => {
				failed(res, err.message, "failed", "get user failed");
			});
	},

	searchEmail: (req, res) => {
		const email = req.params.email;

		userModel.checkEmail(email)
		.then((result) => {
			success(res, result.rows, "success", "get email success");
		})
		.catch((err) => {
			failed(res, err.message, "failed", "get email failed");
		});
	},

	register: (req, res) => {
		try {
			const { username, email, password } = req.body;
			bcrypt.hash(password, 10, async(err, hash) => {
				if (err) {
					failed(res, err.message, "failed", "failed hash password");
				}

				const photo = req.file ? await cloudinary.uploader.upload(req.file.path) : {secure_url: "https://res.cloudinary.com/dmkviiqax/image/upload/v1670752651/default_qxzbhn.png", public_id: ""};

				const data = {
					username,
					email,
					password: hash,
					photo: `${photo.secure_url}|&&|${photo.public_id}`,
				};

				userModel.checkEmail(email)
				.then((result) => {
					if (result.rowCount == 0) {
						userModel.checkUsername(username)
						.then((result) => {
							if (result.rowCount == 0) {
								userModel.register(data)
								.then((result) => {
									success(res, result, "success", "register success");
								})
								.catch((err) => {
									failed(res, err.message, "failed", "register failed");
								});
							}else{
								failed(res, null, "failed", "username has been taken");
							}
						})
					}

					if (result.rowCount > 0) {
						failed(res, null, "failed", "email has been registered");
					}
				});
			});
		} catch (err) {
			failed(res, err.message, "failed", "internal server error");
		}
	},

	login: (req, res) => {
		const { email, password } = req.body;

		const login = (user) => {
			bcrypt.compare(password, user.password)
			.then(async (result) => {
				if (result) {
					const token = await jwtToken({
						email: user.email,
						level: user.level,
					});
					delete user.password;
					successWithToken(
						res,
						{ token, data: user },
						"success",
						"login success"
					);
				} else {
					failed(res, null, "failed", "username or password incorrect");
				}
			});
		}

		userModel
			.checkEmail(email)
			.then((result) => {
				if (result.rowCount > 0) {
					login(result.rows[0]);
				} else {
					userModel.checkUsername(email)
					.then((result) => {
						if (result.rowCount > 0) {
							login(result.rows[0]);
						}else{
							failed(res, null, "failed", "username or password incorrect");
						}
					})
					.catch((err) => {
						failed(res, null, "failed", "username or password incorrect");
					})
				}
			})
			.catch((err) => {
				failed(res, err.message, "failed", "internal server error");
			});
	},

	updateUser: (req, res) => {
		const id = req.params.id;
		
		const {
			username,
			fullname,
			email,
			credit_card,
			phone,
			city,
			address,
			post_code,
			level,
			balance,
			gender,
		} = req.body;

		const data = {
			id,
			username,
			fullname,
			email,
			credit_card,
			phone,
			city,
			address,
			post_code,
			level,
			balance: typeof balance !== "integer" ? (balance === "" ? null : parseInt(balance)) : balance,
			gender,
		};

		userModel.updateProfile(data)
		.then((result) => {
			userModel.selectUserId(data.id)
			.then((result) => {
				const user = result.rows[0];
				delete user.password;
				success(res, user, 'success', 'Update user success')
			})
		})
		.catch((error) => {
			failed(res, error.message, "failed", "failed hash password");
		});
	},

	updateUserPassword: (req, res) => {
		const { email, password } = req.body;
		bcrypt.hash(password, 10, (err, hash) => {
			if (err) {
				failed(res, err.message, "failed", "failed hash password");
			}

			const data = {
				email,
				password: hash,
			};

			userModel.checkEmail(email).then((result) => {
				if (result.rowCount == 1) {
					userModel
						.forgotUserPassword(data)
						.then((result) => {
							success(res, result, "success", "update password success");
						})
						.catch((err) => {
							failed(res, err.message, "failed", "update password failed");
						});
				}

				if (result.rowCount == 0) {
					failed(res, null, "failed", "email is not registered");
				}
			});
		});
	},

	updatePhoto: async(req, res) => {
		const id = await req.params.id;
		const img = await cloudinary.uploader.upload(req.file.path);
		const photo = `${img.secure_url}|&&|${img.public_id}`
		userModel
			.updatePhoto(id, photo)
			.then((result) => {
				res.json(result);
			})
			.catch((error) => {
				res.json(error);
			});
	},

	deleteUser: (req, res) => {
		const id = req.params.id;

		userModel
			.deleteUser(id)
			.then((result) => {
				res.json(result);
			})
			.catch((error) => {
				res.json(error);
			});
	},
};

module.exports = userController;
