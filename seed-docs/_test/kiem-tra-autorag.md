# [TÀI LIỆU TEST] Kiểm tra hệ thống AutoRAG — Daisan Internal AI

> Đây là tài liệu **mẫu để kiểm tra** pipeline RAG (chunk → embed → truy hồi → trích dẫn)
> với tiếng Việt. Sau khi xác nhận chạy đúng, có thể **xóa file này** và thay bằng tài liệu thật.

## Câu hỏi mẫu để test
"Cách tạo hóa đơn bán hàng cho khách trong Odoo?"

## Nội dung tham khảo (Odoo - Kế toán)

Để tạo hóa đơn bán hàng (customer invoice) trong Odoo:

1. Vào menu **Kế toán > Khách hàng > Hóa đơn** (Accounting > Customers > Invoices).
2. Bấm **Mới** (New) để tạo hóa đơn nháp.
3. Chọn **Khách hàng** ở ô Customer; Odoo tự điền địa chỉ và điều khoản thanh toán.
4. Ở tab **Dòng hóa đơn** (Invoice Lines), thêm sản phẩm/dịch vụ, số lượng, đơn giá, thuế.
5. Kiểm tra **Ngày hóa đơn** và **Hạn thanh toán** (Due Date).
6. Bấm **Xác nhận** (Confirm) để chuyển hóa đơn từ trạng thái *Nháp* sang *Đã vào sổ* (Posted).
7. Bấm **Gửi & In** (Send & Print) để gửi hóa đơn cho khách qua email.

## Thuật ngữ
- **Hóa đơn nháp (Draft):** chưa ghi sổ kế toán, còn sửa được.
- **Đã vào sổ (Posted):** đã ghi nhận công nợ phải thu, không sửa tự do được nữa.
- **Công nợ phải thu (Account Receivable):** số tiền khách còn nợ sau khi hóa đơn được xác nhận.
