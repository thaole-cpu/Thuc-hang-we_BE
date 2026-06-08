import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddPhoneDto } from './dto/add-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { AddAddressDto } from './dto/add-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { SaveVoucherDto } from './dto/save-voucher.dto';
import { UserProfile, UserProfileDocument } from './schemas/user-profile.schema';
import { UserPhone, UserPhoneDocument } from './schemas/user-phone.schema';
import { UserAddress, UserAddressDocument } from './schemas/user-address.schema';
import { User, UserDocument } from './schemas/user.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { OrderStatus } from 'src/common/constants/order-status.constant';
import { ExcelBaseService } from 'src/shared/csv/excel.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(UserProfile.name)
    private readonly userProfileModel: Model<UserProfileDocument>,

    @InjectModel(UserPhone.name)
    private readonly userPhoneModel: Model<UserPhoneDocument>,

    @InjectModel(UserAddress.name)
    private readonly userAddressModel: Model<UserAddressDocument>,

    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,

    private readonly excelService: ExcelBaseService,
  ) {}

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    return new Types.ObjectId(id);
  }

  /** Địa chỉ chưa xóa mềm — schema default deleted_at: null nên phải dùng null, không dùng $exists: false */
  private activeAddressFilter(userId: Types.ObjectId, extra: Record<string, unknown> = {}) {
    return { user_id: userId, deleted_at: null, ...extra };
  }

  // ================= PROFILE (LẤY & CẬP NHẬT THÔNG TIN CÁ NHÂN) =================
  
  /** Load account, profile, phones, and addresses for the current user. */
  async getMe(userId: string) {
    const objectId = this.toObjectId(userId);
    
    const [user, profile, phones, addresses] = await Promise.all([
      this.userModel.findById(objectId).select('-password').exec(), // Lấy tài khoản gốc (Email, Role, CreatedAt)
      this.userProfileModel.findOne({ user_id: objectId }).exec(),   // Lấy Bio, Avatar, Banner
      this.userPhoneModel.find({ user_id: objectId, status: 'active' }).exec(),
      this.userAddressModel
        .find(this.activeAddressFilter(objectId, { status: 'active' }))
        .exec(),
    ]);

    if (!user) throw new NotFoundException('Không tìm thấy tài khoản người dùng');

    return {
      account: user,
      profile,
      phones,
      addresses,
      savedVouchers: profile?.saved_vouchers || [],
    };
  }

  async updateProfile(userId: string, dto: any) {
    const objectId = this.toObjectId(userId);
    const payload: Partial<UserProfile> = {};
    
    if (dto.full_name !== undefined) payload.full_name = dto.full_name.trim();
    if (dto.gender !== undefined) payload.gender = dto.gender;
    if (dto.avatar_url !== undefined) payload.avatar_url = dto.avatar_url;
    if (dto.banner_url !== undefined) payload.banner_url = dto.banner_url; 
    if (dto.bio !== undefined) payload.bio = dto.bio; 
    if (dto.phone !== undefined) payload.phone = dto.phone;
    if (dto.date_of_birth !== undefined) {
      payload.date_of_birth = dto.date_of_birth ? new Date(dto.date_of_birth) : undefined;
    }

    return this.userProfileModel
      .findOneAndUpdate({ user_id: objectId }, { $set: payload }, { new: true, upsert: true })
      .exec();
  }

  private defaultNotificationPrefs() {
    return {
      emailAlerts: true,
      pushAlerts: true,
      newOrderAlerts: true,
      cancelOrderAlerts: true,
    };
  }

  private defaultRegionalPrefs() {
    return { timezone: 'gmt7', dateFormat: 'dmy', currency: 'vnd' };
  }

  private normalizePreferences(profile: UserProfileDocument | null) {
    return {
      locale: profile?.locale || 'vi-VN',
      notification_prefs: {
        ...this.defaultNotificationPrefs(),
        ...(profile?.notification_prefs || {}),
      },
      regional_prefs: {
        ...this.defaultRegionalPrefs(),
        ...(profile?.regional_prefs || {}),
      },
    };
  }

  async getPreferences(userId: string) {
    const objectId = this.toObjectId(userId);
    const profile = await this.userProfileModel.findOne({ user_id: objectId }).exec();
    return this.normalizePreferences(profile);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const objectId = this.toObjectId(userId);
    const existing = await this.userProfileModel.findOne({ user_id: objectId }).exec();
    const current = this.normalizePreferences(existing);

    const payload: Partial<UserProfile> = {
      locale: dto.locale ?? current.locale,
      notification_prefs: {
        ...current.notification_prefs,
        ...(dto.notification_prefs || {}),
      },
      regional_prefs: {
        ...current.regional_prefs,
        ...(dto.regional_prefs || {}),
      },
    };

    const profile = await this.userProfileModel
      .findOneAndUpdate({ user_id: objectId }, { $set: payload }, { new: true, upsert: true })
      .exec();

    return this.normalizePreferences(profile);
  }

  async findAdminUserIdsForNotification(
    prefKey: 'newOrderAlerts' | 'cancelOrderAlerts',
  ): Promise<string[]> {
    const admins = await this.userModel
      .find({ roles: { $in: ['ADMIN'] }, status: { $ne: 'blocked' } })
      .select('_id')
      .lean()
      .exec();

    if (!admins.length) return [];

    const adminIds = admins.map((a) => a._id);
    const profiles = await this.userProfileModel
      .find({ user_id: { $in: adminIds } })
      .lean()
      .exec();

    const profileMap = new Map(profiles.map((p) => [p.user_id.toString(), p]));

    return admins
      .filter((admin) => {
        const profile = profileMap.get(admin._id.toString()) ?? null;
        const prefs = this.normalizePreferences(profile as UserProfileDocument | null);
        return prefs.notification_prefs[prefKey] !== false;
      })
      .map((admin) => admin._id.toString());
  }

  // ================= ADMIN: QUẢN LÝ KHÁCH HÀNG =================

  private static readonly VIP_SPENT_THRESHOLD = 5_000_000;

  private buildAdminUserListStages(filters: {
    search?: string;
    status?: 'active' | 'blocked';
    verified?: 'true' | 'false';
    vip?: 'true';
  }) {
    const userProfilesCol = this.userProfileModel.collection.name;
    const ordersCol = this.orderModel.collection.name;

    const baseMatch: any = { roles: { $in: ['USER'] } };
    if (filters.status) baseMatch.status = filters.status;

    const stages: any[] = [
      { $match: baseMatch },
      {
        $lookup: {
          from: userProfilesCol,
          localField: '_id',
          foreignField: 'user_id',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: ordersCol,
          let: { uId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $toString: '$userId' }, { $toString: '$$uId' }] },
                    { $eq: ['$status', OrderStatus.COMPLETED] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalSpent: { $sum: '$totalAmount' },
              },
            },
          ],
          as: 'orderStats',
        },
      },
      { $unwind: { path: '$orderStats', preserveNullAndEmptyArrays: true } },
    ];

    const andConditions: any[] = [];
    if (filters.search?.trim()) {
      const regex = { $regex: filters.search.trim(), $options: 'i' };
      andConditions.push({
        $or: [
          { email: regex },
          { name: regex },
          { 'profile.full_name': regex },
        ],
      });
    }
    if (filters.verified === 'true') andConditions.push({ isEmailVerified: true });
    if (filters.verified === 'false') andConditions.push({ isEmailVerified: false });
    if (andConditions.length === 1) stages.push({ $match: andConditions[0] });
    else if (andConditions.length > 1) stages.push({ $match: { $and: andConditions } });

    stages.push({
      $project: {
        _id: 1,
        email: 1,
        name: { $ifNull: ['$profile.full_name', '$name'] },
        avatar: { $ifNull: ['$profile.avatar_url', null] },
        isEmailVerified: 1,
        status: { $ifNull: ['$status', 'active'] },
        createdAt: 1,
        totalOrders: { $ifNull: ['$orderStats.totalOrders', 0] },
        totalSpent: { $ifNull: ['$orderStats.totalSpent', 0] },
      },
    });

    if (filters.vip === 'true') {
      stages.push({
        $match: { totalSpent: { $gte: UsersService.VIP_SPENT_THRESHOLD } },
      });
    }

    return stages;
  }

  async findAllForAdmin(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    filters: { status?: 'active' | 'blocked'; verified?: 'true' | 'false'; vip?: 'true' } = {},
  ) {
    const skip = (page - 1) * limit;
    const baseStages = this.buildAdminUserListStages({ search, ...filters });

    const [users, countResult] = await Promise.all([
      this.userModel
        .aggregate([...baseStages, { $sort: { _id: -1 } }, { $skip: skip }, { $limit: limit }])
        .option({ allowDiskUse: true }),
      this.userModel.aggregate([...baseStages, { $count: 'total' }]).option({ allowDiskUse: true }),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async getStatsForAdmin() {
    const matchStage: any = { roles: { $in: ['USER'] } };
    const totalCustomers = await this.userModel.countDocuments(matchStage);
    const ordersCol = this.orderModel.collection.name;

    const userStats = await this.userModel.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: ordersCol,
          let: { uId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $toString: '$userId' }, { $toString: '$$uId' }] },
                    { $eq: ['$status', OrderStatus.COMPLETED] },
                  ],
                },
              },
            },
            { $group: { _id: null, totalSpent: { $sum: '$totalAmount' } } },
          ],
          as: 'orderStats',
        },
      },
      { $unwind: { path: '$orderStats', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          totalSpent: { $ifNull: ['$orderStats.totalSpent', 0] },
        },
      },
    ]).option({ allowDiskUse: true });

    const totalRevenue = userStats.reduce((sum, u) => sum + (u.totalSpent || 0), 0);
    const vipCount = userStats.filter((u) => (u.totalSpent || 0) >= UsersService.VIP_SPENT_THRESHOLD).length;

    return { totalCustomers, totalRevenue, vipCount };
  }

  async updateUserStatus(userId: string, status: 'active' | 'blocked') {
    const objectId = this.toObjectId(userId);
    const user = await this.userModel.findById(objectId).exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }
    if (user.roles?.includes('ADMIN')) {
      throw new BadRequestException('Không thể khóa tài khoản quản trị');
    }
    user.status = status;
    await user.save();
    return { id: user._id, status: user.status };
  }

  /** Export customer list to Excel for admin. */
  async exportForAdmin(
    search: string = '',
    exportOptions?: string,
    filters: { status?: 'active' | 'blocked'; verified?: 'true' | 'false'; vip?: 'true' } = {},
  ): Promise<Buffer> {
    const users = await this.userModel
      .aggregate([
        ...this.buildAdminUserListStages({ search, ...filters }),
        { $sort: { _id: -1 } },
      ])
      .option({ allowDiskUse: true });

    const allFieldsMap: Record<string, (item: any) => any> = {
      email:           (u) => u.email || 'N/A',
      name:            (u) => u.name || '—',
      isEmailVerified: (u) => (u.isEmailVerified ? 'Đã xác thực' : 'Chưa xác thực'),
      status:          (u) => (u.status === 'blocked' ? 'Đã khóa' : 'Hoạt động'),
      createdAt:       (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—',
      totalOrders:     (u) => u.totalOrders,
      totalSpent:      (u) => u.totalSpent,
    };

    let fieldsToExport = Object.keys(allFieldsMap);
    if (exportOptions) {
      const requested = Array.isArray(exportOptions)
        ? exportOptions
        : exportOptions.split(',');
      fieldsToExport = requested.filter((f) => allFieldsMap[f]);
    }

    const excelData = users.map((u) => {
      const row: any = {};
      fieldsToExport.forEach((field) => {
        row[field] = allFieldsMap[field](u);
      });
      return row;
    });

    return this.excelService.exportData(excelData, fieldsToExport);
  }

  async getDetailForAdmin(userId: string) {
    const objectId = this.toObjectId(userId);

    const user = await this.userModel.findById(objectId).select('-password').exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy khách hàng trong hệ thống.');
    }

    const [profile, phones, addresses] = await Promise.all([
      this.userProfileModel.findOne({ user_id: objectId }).exec(),
      this.userPhoneModel.find({ user_id: objectId }).exec(),
      this.userAddressModel.find({ user_id: objectId, deleted_at: null }).exec(),
    ]);

    const recentOrders = await this.orderModel
      .find({ userId: objectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderCode totalAmount status paymentMethod paymentStatus createdAt')
      .exec();

    const [stats] = await this.orderModel.aggregate([
      {
        $match: {
          userId: objectId,
          status: OrderStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    return {
      account: {
        id: user._id,
        email: user.email,
        roles: user.roles,
        status: (user as any).status || 'active',
        isEmailVerified: user.isEmailVerified,
        createdAt: (user as any).createdAt,
      },
      profile: {
        fullName: profile?.full_name || user.name || null,
        avatar: profile?.avatar_url || null,
        gender: profile?.gender || 'unknown',
        dateOfBirth: profile?.date_of_birth || null,
      },
      contacts: {
        phones,
        addresses,
      },
      metrics: {
        totalSpent: stats?.totalSpent || 0,
        totalOrders: stats?.totalOrders || 0,
      },
      recentOrders,
    };
  }

  // ================= PHONE =================
  async addPhone(userId: string, dto: AddPhoneDto) {
    const objectId = this.toObjectId(userId);
    if (dto.is_default === true) {
      await this.userPhoneModel
        .updateMany({ user_id: objectId }, { $set: { is_default: false } })
        .exec();
    }
    const phone = await this.userPhoneModel.create({
      user_id: objectId,
      region_code: dto.region_code,
      country_calling_code: dto.country_calling_code,
      national_number: dto.national_number,
      full_phone_e164: `${dto.country_calling_code}${dto.national_number}`,
      phone_type: dto.phone_type ?? 'personal',
      is_default: dto.is_default ?? false,
      status: 'active',
    });
    if (dto.is_default === true) {
      await this.userProfileModel.updateOne(
        { user_id: objectId },
        { $set: { default_phone_id: phone._id } },
      );
    }
    return phone;
  }

  async updatePhone(userId: string, phoneId: string, dto: UpdatePhoneDto) {
    const objectId = this.toObjectId(userId);
    const phoneObjectId = this.toObjectId(phoneId);
    const phone = await this.userPhoneModel.findOne({ _id: phoneObjectId, user_id: objectId });
    if (!phone) throw new NotFoundException('Không tìm thấy phone');
    if (dto.is_default === true) {
      await this.userPhoneModel.updateMany({ user_id: objectId }, { $set: { is_default: false } });
    }
    if ('full_phone_e164' in dto) delete (dto as any).full_phone_e164;
    const country = dto.country_calling_code ?? phone.country_calling_code;
    const number = dto.national_number ?? phone.national_number;
    const fullPhone = (dto.country_calling_code || dto.national_number)
      ? `${country}${number}`
      : phone.full_phone_e164;
    const updated = await this.userPhoneModel.findOneAndUpdate(
      { _id: phoneObjectId, user_id: objectId },
      { ...dto, full_phone_e164: fullPhone },
      { new: true, runValidators: true },
    );
    if (dto.is_default === true && updated) {
      await this.userProfileModel.updateOne(
        { user_id: objectId },
        { $set: { default_phone_id: updated._id } },
      );
    }
    return updated;
  }

  async setDefaultPhone(userId: string, phoneId: string) {
    const objectId = this.toObjectId(userId);
    const phoneObjectId = this.toObjectId(phoneId);
    const phone = await this.userPhoneModel.findOne({ _id: phoneObjectId, user_id: objectId });
    if (!phone) throw new NotFoundException('Không tìm thấy phone');
    await this.userPhoneModel.updateMany({ user_id: objectId }, { $set: { is_default: false } });
    await this.userPhoneModel.updateOne({ _id: phoneObjectId }, { $set: { is_default: true } });
    await this.userProfileModel.updateOne(
      { user_id: objectId },
      { $set: { default_phone_id: phoneObjectId } },
    );
    return { message: 'Đã set default phone' };
  }

  async removePhone(userId: string, phoneId: string) {
    const objectId = this.toObjectId(userId);
    const phoneObjectId = this.toObjectId(phoneId);
    const phone = await this.userPhoneModel.findOne({ _id: phoneObjectId, user_id: objectId });
    if (!phone) throw new NotFoundException('Không tìm thấy phone');
    await this.userPhoneModel.deleteOne({ _id: phoneObjectId });
    const remaining = await this.userPhoneModel.find({ user_id: objectId });
    if (remaining.length === 0) {
      await this.userProfileModel.updateOne(
        { user_id: objectId },
        { $unset: { default_phone_id: '' } },
      );
    }
    return { message: 'Đã xóa phone' };
  }

  // ================= ADDRESS =================
  async addAddress(userId: string, dto: AddAddressDto) {
    const objectId = this.toObjectId(userId);
    if (dto.is_default === true) {
      await this.userAddressModel
        .updateMany(this.activeAddressFilter(objectId), { $set: { is_default: false } })
        .exec();
    }
    const address = await this.userAddressModel.create({
      user_id: objectId,
      ...dto,
      status: 'active',
    });
    if (dto.is_default === true) {
      await this.userProfileModel
        .updateOne({ user_id: objectId }, { $set: { default_address_id: address._id } })
        .exec();
    }
    return address;
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const objectId = this.toObjectId(userId);
    const addressObjectId = this.toObjectId(addressId);
    const address = await this.userAddressModel.findOne(
      this.activeAddressFilter(objectId, { _id: addressObjectId }),
    );
    if (!address) throw new NotFoundException('Không tìm thấy address');
    if (dto.is_default === true) {
      await this.userAddressModel.updateMany(
        this.activeAddressFilter(objectId),
        { $set: { is_default: false } },
      );
    }
    const updateData: any = { ...dto };
    delete updateData._id;
    delete updateData.user_id;
    const updated = await this.userAddressModel.findByIdAndUpdate(
      addressObjectId,
      { $set: updateData },
      { new: true },
    );
    if (dto.is_default === true && updated) {
      await this.userProfileModel.updateOne(
        { user_id: objectId },
        { $set: { default_address_id: updated._id } },
      );
    }
    return updated;
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const objectId = this.toObjectId(userId);
    const addressObjectId = this.toObjectId(addressId);
    const address = await this.userAddressModel.findOne(
      this.activeAddressFilter(objectId, { _id: addressObjectId }),
    );
    if (!address) throw new NotFoundException('Không tìm thấy address');
    if (address.is_default) return address;
    await this.userAddressModel.updateMany(
      this.activeAddressFilter(objectId),
      { $set: { is_default: false } },
    );
    address.is_default = true;
    await address.save();
    await this.userProfileModel.updateOne(
      { user_id: objectId },
      { $set: { default_address_id: addressObjectId } },
    );
    return address;
  }

  async removeAddress(userId: string, addressId: string) {
    const objectId = this.toObjectId(userId);
    const addressObjectId = this.toObjectId(addressId);
    const address = await this.userAddressModel
      .findOne(this.activeAddressFilter(objectId, { _id: addressObjectId }))
      .exec();
    if (!address) throw new NotFoundException('Không tìm thấy address');
    await this.userAddressModel
      .updateOne(
        { _id: address._id },
        { $set: { deleted_at: new Date(), status: 'inactive', is_default: false } },
      )
      .exec();
    const remaining = await this.userAddressModel
      .find(this.activeAddressFilter(objectId, { status: 'active' }))
      .exec();
    if (remaining.length === 0) {
      await this.userProfileModel
        .updateOne({ user_id: objectId }, { $unset: { default_address_id: '' } })
        .exec();
      return { message: 'Đã xóa address' };
    }
    const hasDefault = remaining.some((item) => item.is_default === true);
    if (!hasDefault) {
      const fallback = remaining[0];
      await this.userAddressModel
        .updateOne({ _id: fallback._id }, { $set: { is_default: true } })
        .exec();
      await this.userProfileModel
        .updateOne({ user_id: objectId }, { $set: { default_address_id: fallback._id } })
        .exec();
    }
    return { message: 'Đã xóa address' };
  }

  // ================= SAVED VOUCHERS (VÍ VOUCHER KHÁCH HÀNG) =================

  async addSavedVoucher(userId: string, dto: SaveVoucherDto) {
    const objectId = this.toObjectId(userId);
    const code = dto.code.trim().toUpperCase();
    const entry = {
      code,
      name: dto.name || `Voucher ${code}`,
      discount_amount: dto.discount_amount ?? 0,
      expires_at: dto.expires_at ? new Date(dto.expires_at) : undefined,
      min_order: dto.min_order ?? 0,
      saved_at: new Date(),
    };

    const profile = await this.userProfileModel.findOne({ user_id: objectId }).exec();
    const list = [...(profile?.saved_vouchers || [])];
    const idx = list.findIndex((v) => v.code === code);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...entry };
    } else {
      list.unshift(entry);
    }

    const updated = await this.userProfileModel
      .findOneAndUpdate(
        { user_id: objectId },
        { $set: { saved_vouchers: list } },
        { new: true, upsert: true },
      )
      .exec();

    return updated?.saved_vouchers || list;
  }

  async removeSavedVoucher(userId: string, code: string) {
    const objectId = this.toObjectId(userId);
    const normalized = code.trim().toUpperCase();
    const profile = await this.userProfileModel.findOne({ user_id: objectId }).exec();
    if (!profile) throw new NotFoundException('Không tìm thấy hồ sơ');

    const list = (profile.saved_vouchers || []).filter((v) => v.code !== normalized);
    await this.userProfileModel
      .updateOne({ user_id: objectId }, { $set: { saved_vouchers: list } })
      .exec();

    return { message: 'Đã xóa voucher khỏi ví' };
  }

  async updateAvatarUrl(userId: string, avatarUrl: string) {
    const objectId = this.toObjectId(userId);
    return this.userProfileModel
      .findOneAndUpdate(
        { user_id: objectId },
        { $set: { avatar_url: avatarUrl } },
        { new: true, upsert: true },
      )
      .exec();
  }
}