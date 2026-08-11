import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export default function StudentsPanel() {
  const [students, setStudents] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name"));
    return onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await addDoc(collection(db, "students"), {
      name: name.trim(),
      createdAt: Date.now(),
    });
    setName("");
  }

  async function handleDelete(id) {
    if (!confirm("هل أنت متأكد من حذف هذا الطالب؟ سيتم الاحتفاظ بسجلاته.")) return;
    await deleteDoc(doc(db, "students", id));
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditingName(s.name);
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    await updateDoc(doc(db, "students", id), { name: editingName.trim() });
    setEditingId(null);
  }

  return (
    <div className="panel">
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="اسم الطالب الجديد"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">إضافة طالب</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>
                {editingId === s.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  s.name
                )}
              </td>
              <td className="actions">
                {editingId === s.id ? (
                  <>
                    <button onClick={() => saveEdit(s.id)}>حفظ</button>
                    <button className="ghost" onClick={() => setEditingId(null)}>
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    <button className="ghost" onClick={() => startEdit(s)}>
                      تعديل
                    </button>
                    <button className="danger" onClick={() => handleDelete(s.id)}>
                      حذف
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan={2} className="empty">
                لا يوجد طلاب بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
