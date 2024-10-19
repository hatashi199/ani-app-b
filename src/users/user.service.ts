import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { EditUserDto } from './dto/edit-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import * as bcryptjs from 'bcryptjs';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload';
import { BackendResponse } from './interfaces/backend-response';
import { DeleteUserDto } from './dto/delete-user.dto';

@Injectable()
export class UserService {
	constructor(
		@InjectModel(User.name)
		private user_model: Model<User>,
		private jwtService: JwtService
	) {}

	async register(
		registerUserDto: RegisterUserDto
	): Promise<BackendResponse<User>> {
		try {
			const { password, ...userData } = registerUserDto;
			const newUser = new this.user_model({
				password: bcryptjs.hashSync(password, 10),
				...userData
			});

			await newUser.save();

			const { password: pass_temp, ...user } = newUser.toJSON();

			return {
				data: user,
				createdAt: new Date(),
				message: 'Usuario creado'
			};
		} catch (error) {
			if (error.code === 11000)
				throw new BadRequestException(
					'Ya existe una cuenta con ese email/usuario'
				);

			throw new InternalServerErrorException(
				'Error interno en el servidor'
			);
		}
	}

	async login(loginUserDto: LoginUserDto): Promise<BackendResponse<string>> {
		try {
			const { email, username } = loginUserDto;

			if (!email && !username) {
				throw new BadRequestException(
					'El usuario o el email debe ser proporcionado'
				);
			}

			if (username)
				return await this.isLoginValid(username, loginUserDto);
			if (email) return await this.isLoginValid(email, loginUserDto);
		} catch (error) {
			throw error;
		}
	}

	async findAll(): Promise<BackendResponse<User[]>> {
		const allUsers = await this.user_model.find();
		const finalData = allUsers.map((user) => {
			const { password, ...userData } = user.toJSON();
			return { ...userData };
		});

		return {
			data: finalData,
			message: 'Información enviada'
		};
	}

	async findOne(id: string): Promise<BackendResponse<User>> {
		const user = await this.user_model.findById(id);

		this.userExist(user);

		const { password, ...userData } = user.toJSON();
		return {
			data: userData,
			message: 'Información enviada'
		};
	}

	async editOne(
		id: string,
		editUserDto: EditUserDto
	): Promise<BackendResponse<User>> {
		try {
			await this.user_model.findByIdAndUpdate(id, editUserDto);

			const { data } = await this.findOne(id);

			return {
				data,
				message: 'Información del usuario actualizada'
			};
		} catch (error) {
			if (error.code === 404)
				throw new NotFoundException('No existe el usuario');
			throw new InternalServerErrorException(
				'Error Interno en el Servidor'
			);
		}
	}

	async removeOne(
		id: string,
		deleteUserDto: DeleteUserDto
	): Promise<BackendResponse<string>> {
		try {
			await this.user_model.findByIdAndUpdate(id, deleteUserDto);

			const { data } = await this.findOne(id);

			return {
				data: data.username,
				deletedAt: new Date(),
				message: `Usuario ${data.username} desactivado`
			};
		} catch (error) {
			if (error.code === 404)
				throw new NotFoundException('No existe el usuario');
			throw new InternalServerErrorException(
				'Error Interno en el Servidor'
			);
		}
	}

	// Helpers
	async isLoginValid(
		prop: string,
		loginUserDto: LoginUserDto
	): Promise<BackendResponse<string>> {
		try {
			const propLogIn = await this.user_model.findOne({ username: prop });
			if (!propLogIn) {
				throw new UnauthorizedException('Usuario/email incorrectos');
			}

			if (
				!bcryptjs.compareSync(loginUserDto.password, propLogIn.password)
			)
				throw new UnauthorizedException('Contraseña incorrecta');

			const { password: pass_temp, ...loginData } = propLogIn.toJSON();

			const token = this.getJWTToken({ id: propLogIn.id });

			return {
				data: loginData.username,
				message: 'Sesión iniciada',
				token
			};
		} catch (error) {
			console.log(error);
			throw error;
		}
	}

	getJWTToken(payload: JwtPayload) {
		const access_token = this.jwtService.sign(payload);
		return access_token;
	}

	userExist(user: User): void {
		if (!user) throw new NotFoundException('No existe el usuario');
		if (!user.isActive) throw new NotFoundException('No existe el usuario');
	}
}