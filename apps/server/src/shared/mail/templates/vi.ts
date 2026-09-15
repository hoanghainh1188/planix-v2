import type { MailTemplates } from './render.ts';

export const vi: MailTemplates = {
  organizationInvitation: ({ organizationName, acceptUrl }) => ({
    subject: `Lời mời tham gia ${organizationName} trên Planix`,
    text: [
      `Bạn được mời tham gia tổ chức ${organizationName} trên Planix.`,
      '',
      `Chấp nhận lời mời: ${acceptUrl}`,
      '',
      'Liên kết có hiệu lực trong 7 ngày và chỉ dùng được một lần.',
    ].join('\n'),
  }),
  passwordReset: ({ resetUrl }) => ({
    subject: 'Đặt lại mật khẩu Planix',
    text: [
      'Có yêu cầu đặt lại mật khẩu cho tài khoản Planix của bạn.',
      '',
      `Đặt mật khẩu mới: ${resetUrl}`,
      '',
      'Liên kết hết hạn sau 1 giờ và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    ].join('\n'),
  }),
};
